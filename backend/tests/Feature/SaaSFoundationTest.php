<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\DatabaseTestCase;

#[Group('integration')]
class SaaSFoundationTest extends DatabaseTestCase
{
    private Tenant $tenant;

    private Tenant $foreignTenant;

    private User $owner;

    private Branch $branch;

    private Branch $foreignBranch;

    private Room $room;

    private Room $foreignRoom;

    private RoomRate $foreignRate;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->foreignTenant = Tenant::factory()->create();
        $this->owner = User::factory()->create();
        $this->tenant->users()->attach($this->owner, ['role' => 'owner']);
        $context = app(TenantContext::class);
        $context->tenant = $this->foreignTenant;
        $context->role = 'owner';
        $this->foreignBranch = Branch::factory()->create();
        $this->foreignRoom = Room::factory()->create(['branch_id' => $this->foreignBranch->id]);
        $this->foreignRate = RoomRate::factory()->create(['room_id' => $this->foreignRoom->id]);
        $context->tenant = $this->tenant;
        $this->branch = Branch::factory()->create();
        $this->room = Room::factory()->create(['branch_id' => $this->branch->id]);
        $this->actingAs($this->owner, 'web')->withSession(['active_tenant_id' => $this->tenant->id])
            ->withHeader('Origin', 'http://127.0.0.1:5173');
    }

    public function test_branch_lifecycle_and_tenant_injection_rejection(): void
    {
        $id = $this->postJson('/api/v1/branches', ['name' => 'Centro', 'address' => 'Calle 1'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/branches/'.$id, ['name' => 'Centro renovado'])->assertOk()->assertJsonPath('data.name', 'Centro renovado');
        $this->postJson('/api/v1/branches/'.$id.'/deactivate')->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('branches', ['id' => $id, 'is_active' => false]);
        $this->postJson('/api/v1/branches', ['name' => 'Bad', 'tenant_id' => $this->foreignTenant->id])->assertUnprocessable();
    }

    public function test_room_lifecycle_and_paginated_filters(): void
    {
        $id = $this->postJson('/api/v1/rooms', ['branch_id' => $this->branch->id, 'name' => 'Azul', 'capacity' => 8])
            ->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/rooms/'.$id, ['capacity' => 10, 'operational_status' => 'cleaning'])->assertOk();
        $this->getJson('/api/v1/rooms/'.$id)->assertOk()->assertJsonPath('data.capacity', 10);
        $this->getJson('/api/v1/rooms?search=Azul&operational_status=cleaning&per_page=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
        $this->postJson('/api/v1/rooms/'.$id.'/deactivate')->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('rooms', ['id' => $id]);
    }

    public function test_foreign_records_are_inaccessible_and_lists_are_scoped(): void
    {
        $this->getJson('/api/v1/branches/'.$this->foreignBranch->id)->assertNotFound();
        $this->getJson('/api/v1/rooms/'.$this->foreignRoom->id)->assertNotFound();
        $this->patchJson('/api/v1/rooms/'.$this->foreignRoom->id, ['name' => 'Attack'])->assertNotFound();
        $this->postJson('/api/v1/rates/'.$this->foreignRate->id.'/replace', $this->rate())->assertNotFound();
        $this->getJson('/api/v1/rooms')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->room->id);
        $this->getJson('/api/v1/rates')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_rooms_cannot_use_foreign_or_inactive_branches(): void
    {
        $this->postJson('/api/v1/rooms', ['branch_id' => $this->foreignBranch->id, 'name' => 'Bad', 'capacity' => 2])->assertUnprocessable();
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertStatus(409);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/rooms', ['branch_id' => $this->branch->id, 'name' => 'Bad', 'capacity' => 2])->assertUnprocessable();
    }

    public function test_invalid_room_states_and_capacity_are_rejected(): void
    {
        foreach ([['capacity' => 0], ['capacity' => -1], ['capacity' => 1.5], ['operational_status' => 'occupied']] as $invalid) {
            $this->patchJson('/api/v1/rooms/'.$this->room->id, $invalid)->assertUnprocessable();
        }
    }

    public function test_employee_can_read_but_cannot_administer_and_admin_can_manage_rooms(): void
    {
        $this->tenant->users()->updateExistingPivot($this->owner->id, ['role' => 'employee']);
        $this->getJson('/api/v1/rooms')->assertOk();
        $this->getJson('/api/v1/rates')->assertOk();
        $this->postJson('/api/v1/branches', ['name' => 'No'])->assertForbidden();
        $this->patchJson('/api/v1/rooms/'.$this->room->id, ['name' => 'No'])->assertForbidden();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertForbidden();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertForbidden();
        $this->getJson('/api/v1/members')->assertForbidden();
        $this->patchJson('/api/v1/tenant', ['name' => 'No'])->assertForbidden();
        $this->tenant->users()->updateExistingPivot($this->owner->id, ['role' => 'admin']);
        $this->postJson('/api/v1/branches', ['name' => 'Sí'])->assertCreated();
        $this->patchJson('/api/v1/rooms/'.$this->room->id, ['name' => 'Sí'])->assertOk();
        $this->getJson('/api/v1/members')->assertForbidden();
    }

    public function test_rate_replacement_preserves_history_and_decimal_strings(): void
    {
        $first = $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertCreated()->assertJsonPath('data.hourly_price', '20.00')->json('data.id');
        $second = $this->postJson('/api/v1/rates/'.$first.'/replace', $this->rate('25.50'))->assertCreated()->json('data.id');
        $this->assertDatabaseHas('room_rates', ['id' => $first, 'hourly_price' => '20.00', 'is_active' => false]);
        $this->assertDatabaseHas('room_rates', ['id' => $second, 'hourly_price' => '25.50', 'is_active' => true]);
        $this->assertSame(1, DB::table('room_rates')->where('room_id', $this->room->id)->where('is_active', true)->count());
        $this->getJson('/api/v1/rates?room_id='.$this->room->id)->assertOk()->assertJsonCount(2, 'data');
        $this->postJson('/api/v1/rates/'.$first.'/replace', $this->rate())->assertStatus(409);
    }

    public function test_invalid_prices_are_rejected(): void
    {
        foreach (['-1.00', '1.999', '1e2', '10000000000.00', 'NaN', 10.5] as $price) {
            $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate($price))->assertUnprocessable();
        }
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', [...$this->rate(), 'currency' => 'EUR'])->assertUnprocessable();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate('0.00'))->assertCreated();
    }

    public function test_database_rejects_cross_tenant_room_even_without_model_scope(): void
    {
        $this->expectException(QueryException::class);
        DB::table('rooms')->insert(['id' => fake()->uuid(), 'tenant_id' => $this->tenant->id, 'branch_id' => $this->foreignBranch->id, 'name' => 'Bad', 'capacity' => 1]);
    }

    public function test_database_rejects_cross_tenant_rate(): void
    {
        $this->expectException(QueryException::class);
        DB::table('room_rates')->insert(['id' => fake()->uuid(), 'tenant_id' => $this->tenant->id, 'room_id' => $this->foreignRoom->id, 'name' => 'Bad', 'hourly_price' => '1.00']);
    }

    public function test_database_enforces_one_active_rate(): void
    {
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertCreated();
        $this->expectException(QueryException::class);
        DB::table('room_rates')->insert(['id' => fake()->uuid(), 'tenant_id' => $this->tenant->id, 'room_id' => $this->room->id, 'name' => 'Bad', 'hourly_price' => '1.00']);
    }

    public function test_membership_management_and_last_owner_protection(): void
    {
        $id = $this->postJson('/api/v1/members', ['name' => 'Empleado', 'email' => 'employee@example.test', 'password' => 'TestPassword123!', 'role' => 'employee'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/members/'.$id, ['role' => 'admin'])->assertOk()->assertJsonPath('data.role', 'admin');
        $this->patchJson('/api/v1/members/'.$id, ['is_active' => false])->assertOk();
        $this->patchJson('/api/v1/members/'.$this->owner->id, ['role' => 'employee'])->assertStatus(409);
        $this->getJson('/api/v1/members')->assertOk()->assertJsonCount(2, 'data');
        $this->patchJson('/api/v1/members/'.fake()->uuid(), ['role' => 'admin'])->assertNotFound();
    }

    public function test_dashboard_uses_only_current_tenant_records(): void
    {
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.branches', 1)->assertJsonPath('data.rooms', 1)->assertJsonPath('data.available_rooms', 1);
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertStatus(409);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertOk();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.available_rooms', 0);
    }

    public function test_inactive_rooms_reject_rates_and_invalid_ids_return_not_found(): void
    {
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertStatus(409);
        $this->getJson('/api/v1/rooms/not-a-uuid')->assertNotFound();
    }

    public function test_existing_accounts_are_linked_without_overwriting_global_credentials(): void
    {
        $existing = User::factory()->create(['name' => 'Original']);
        $oldHash = $existing->password;
        $this->postJson('/api/v1/members', ['name' => 'Otro nombre', 'email' => $existing->email, 'role' => 'employee'])
            ->assertCreated()->assertJsonPath('data.name', 'Original');
        $this->assertSame($oldHash, $existing->fresh()->password);
        $this->patchJson('/api/v1/members/'.$existing->id, ['password' => 'ChangedPassword123!'])->assertUnprocessable();
    }

    public function test_operational_queries_fail_closed_without_tenant_context(): void
    {
        app(TenantContext::class)->tenant = null;
        $this->expectException(HttpException::class);
        Room::count();
    }

    public function test_uuid_upgrade_preserves_users_and_session_references(): void
    {
        DB::statement('CREATE SCHEMA upgrade_check');
        DB::statement('SET LOCAL search_path TO upgrade_check');
        $initial = require database_path('migrations/0001_01_01_000000_create_users_table.php');
        $initial->up();
        DB::table('users')->insert(['id' => 42, 'name' => 'Conservado', 'email' => 'legacy@example.test', 'password' => 'preserved-hash']);
        DB::table('sessions')->insert(['id' => 'legacy-session', 'user_id' => 42, 'payload' => 'preserved-payload', 'last_activity' => 1]);
        $upgrade = require database_path('migrations/2026_11_09_195304_convert_users_to_uuid.php');
        $upgrade->up();
        $user = DB::table('users')->first();
        $this->assertTrue(Str::isUuid($user->id));
        $this->assertSame('preserved-hash', $user->password);
        $this->assertSame('Conservado', $user->name);
        $this->assertSame($user->id, DB::table('sessions')->first()->user_id);
        $this->assertSame('preserved-payload', DB::table('sessions')->first()->payload);
    }

    public function test_private_provisioning_creates_an_owner_without_default_credentials(): void
    {
        $this->artisan('karaokeos:provision', ['name' => 'Empresa provisionada', 'slug' => 'provisioned', 'email' => 'provisioned@example.test'])
            ->expectsQuestion('Contraseña del propietario (mínimo 12 caracteres, mayúsculas, minúsculas y números)', 'StrongPassword123!')
            ->assertSuccessful();
        $tenant = Tenant::where('slug', 'provisioned')->firstOrFail();
        $owner = $tenant->users()->firstOrFail();
        $this->assertSame('owner', $owner->pivot->role);
        $this->assertTrue(Hash::check('StrongPassword123!', $owner->password));
    }

    private function rate(mixed $price = '20.00'): array
    {
        return ['name' => 'Estándar', 'hourly_price' => $price, 'currency' => 'USD'];
    }
}
