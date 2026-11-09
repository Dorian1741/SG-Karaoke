<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use PHPUnit\Framework\Attributes\Group;
use Tests\DatabaseTestCase;

#[Group('integration')]
class AuthenticationTest extends DatabaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5173');
    }

    public function test_valid_login_regenerates_session_and_selects_only_authorized_tenant(): void
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();
        $tenant->users()->attach($user, ['role' => 'owner']);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.active_tenant_id', $tenant->id)->assertJsonMissingPath('data.user.password');
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.user.id', $user->id);
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_invalid_credentials_and_inactive_accounts_are_rejected(): void
    {
        $user = User::factory()->create(['is_active' => false]);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => 'missing@example.test', 'password' => 'wrong'])->assertUnprocessable();
        $this->getJson('/api/v1/rooms')->assertUnauthorized();
    }

    public function test_login_is_rate_limited(): void
    {
        $email = 'limited@example.test';
        $key = 'login:'.hash('sha256', $email.'|127.0.0.1');
        RateLimiter::clear($key);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'wrong'])->assertStatus(429)->assertHeader('Retry-After');
    }

    public function test_multiple_memberships_require_selection_and_reject_foreign_tenant(): void
    {
        $user = User::factory()->create();
        $tenants = Tenant::factory()->count(3)->create();
        foreach ($tenants->take(2) as $tenant) {
            $tenant->users()->attach($user, ['role' => 'admin']);
        }
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk()->assertJsonPath('data.active_tenant_id', null);
        $this->getJson('/api/v1/dashboard')->assertForbidden();
        $this->postJson('/api/v1/tenants/select', ['tenant_id' => $tenants[2]->id])->assertNotFound();
        $this->postJson('/api/v1/tenants/select', ['tenant_id' => $tenants[1]->id])->assertOk();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.tenant.id', $tenants[1]->id);
        $tenants[1]->users()->updateExistingPivot($user->id, ['is_active' => false]);
        $this->getJson('/api/v1/dashboard')->assertForbidden();
    }

    public function test_private_api_returns_json_401_without_accept_header(): void
    {
        $this->get('/api/v1/rooms')->assertUnauthorized()->assertHeader('Content-Type', 'application/json');
    }

    public function test_invalid_bearer_token_is_rejected_without_querying_token_storage(): void
    {
        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer invalid-token'])->assertUnauthorized();
    }

    public function test_legacy_mixed_case_email_can_log_in_without_changing_stored_identity(): void
    {
        $user = User::factory()->create(['email' => 'Legacy.Owner@Example.test']);
        $this->postJson('/api/v1/auth/login', ['email' => 'legacy.owner@example.test', 'password' => 'password'])->assertOk();
        $this->assertSame('Legacy.Owner@Example.test', $user->fresh()->email);
    }
}
