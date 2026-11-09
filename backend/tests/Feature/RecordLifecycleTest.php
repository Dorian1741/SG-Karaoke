<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\DatabaseTestCase;

#[Group('integration')]
class RecordLifecycleTest extends DatabaseTestCase
{
    private Tenant $tenant;

    private User $owner;

    private Branch $branch;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->owner = User::factory()->create();
        $this->tenant->users()->attach($this->owner, ['role' => 'owner']);
        $context = app(TenantContext::class);
        $context->tenant = $this->tenant;
        $context->role = 'owner';
        $this->branch = Branch::factory()->create();
        $this->room = Room::factory()->create(['branch_id' => $this->branch->id]);
        $this->actingAs($this->owner, 'web')->withSession(['active_tenant_id' => $this->tenant->id])
            ->withHeader('Origin', 'http://127.0.0.1:5173');
    }

    public function test_branch_with_rooms_cannot_be_deleted_even_when_rooms_are_inactive(): void
    {
        $this->deleteJson('/api/v1/branches/'.$this->branch->id)->assertStatus(409);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertOk();
        $this->deleteJson('/api/v1/branches/'.$this->branch->id)->assertStatus(409);
        $this->assertDatabaseHas('branches', ['id' => $this->branch->id, 'deleted_at' => null]);
    }

    public function test_deleting_room_retains_prices_and_hides_only_the_room(): void
    {
        $rate = $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertCreated()->json('data.id');
        $this->deleteJson('/api/v1/rooms/'.$this->room->id)->assertNoContent();
        $this->getJson('/api/v1/rooms/'.$this->room->id)->assertNotFound();
        $this->getJson('/api/v1/rooms')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/rooms?trashed=only')->assertOk()->assertJsonPath('data.0.id', $this->room->id);
        $this->getJson('/api/v1/rates')->assertOk()->assertJsonPath('data.0.room.id', $this->room->id)->assertJsonPath('data.0.is_active', false);
        $this->assertDatabaseHas('room_rates', ['id' => $rate, 'hourly_price' => '20.00', 'is_active' => false]);
        $this->assertNotNull(DB::table('rooms')->where('id', $this->room->id)->value('deleted_at'));
        $this->getJson('/api/v1/dashboard')->assertJsonPath('data.rooms', 0)->assertJsonPath('data.available_rooms', 0);
    }

    public function test_restore_requires_parent_and_leaves_records_inactive(): void
    {
        $this->deleteJson('/api/v1/rooms/'.$this->room->id)->assertNoContent();
        $this->deleteJson('/api/v1/branches/'.$this->branch->id)->assertNoContent();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/restore')->assertStatus(409);
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/restore')->assertOk()->assertJsonPath('data.is_active', false);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/restore')->assertStatus(409);
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/activate')->assertOk();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/restore')->assertOk()->assertJsonPath('data.is_active', false);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/activate')->assertOk()->assertJsonPath('data.is_active', true);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/restore')->assertStatus(409);
    }

    public function test_price_deletion_and_restoration_do_not_replace_new_active_price(): void
    {
        $first = $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertCreated()->json('data.id');
        $this->deleteJson('/api/v1/rates/'.$first)->assertNoContent();
        $this->getJson('/api/v1/rates')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/rates?trashed=only')->assertJsonPath('data.0.id', $first);
        $second = $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate('30.00'))->assertCreated()->json('data.id');
        $this->postJson('/api/v1/rates/'.$first.'/restore')->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('room_rates', ['id' => $second, 'is_active' => true]);
        $this->assertDatabaseHas('room_rates', ['id' => $first, 'hourly_price' => '20.00', 'deleted_at' => null]);
        $this->assertSame(1, DB::table('room_rates')->where('room_id', $this->room->id)->where('is_active', true)->count());
    }

    public function test_membership_deletion_preserves_global_account_and_other_tenants(): void
    {
        $member = User::factory()->create();
        $other = Tenant::factory()->create();
        $this->tenant->users()->attach($member, ['role' => 'employee']);
        $other->users()->attach($member, ['role' => 'admin']);
        $this->deleteJson('/api/v1/members/'.$member->id)->assertNoContent();
        $this->assertDatabaseHas('users', ['id' => $member->id, 'is_active' => true]);
        $this->assertDatabaseHas('tenant_user', ['tenant_id' => $other->id, 'user_id' => $member->id, 'is_active' => true]);
        $this->getJson('/api/v1/members')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/members?trashed=only')->assertJsonPath('data.0.id', $member->id);
        $this->patchJson('/api/v1/members/'.$member->id, ['is_active' => true])->assertNotFound();
        $this->postJson('/api/v1/members/'.$member->id.'/restore')->assertOk()->assertJsonPath('data.is_active', false);
        $this->patchJson('/api/v1/members/'.$member->id, ['is_active' => true])->assertOk();
    }

    public function test_last_owner_cannot_be_deleted_or_disabled(): void
    {
        $this->deleteJson('/api/v1/members/'.$this->owner->id)->assertStatus(409);
        $this->patchJson('/api/v1/members/'.$this->owner->id, ['is_active' => false])->assertStatus(409);
        $this->assertDatabaseHas('tenant_user', ['tenant_id' => $this->tenant->id, 'user_id' => $this->owner->id, 'removed_at' => null, 'is_active' => true]);
    }

    public function test_employee_cannot_delete_restore_or_read_trash_and_admin_cannot_remove_members(): void
    {
        $this->tenant->users()->updateExistingPivot($this->owner->id, ['role' => 'employee']);
        $this->deleteJson('/api/v1/rooms/'.$this->room->id)->assertForbidden();
        $this->deleteJson('/api/v1/branches/'.$this->branch->id)->assertForbidden();
        $this->getJson('/api/v1/rooms?trashed=only')->assertForbidden();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/restore')->assertForbidden();
        $this->tenant->users()->updateExistingPivot($this->owner->id, ['role' => 'admin']);
        $this->deleteJson('/api/v1/members/'.$this->owner->id)->assertForbidden();
    }

    public function test_foreign_records_cannot_be_deleted_restored_or_seen_in_trash(): void
    {
        $foreign = Tenant::factory()->create();
        app(TenantContext::class)->tenant = $foreign;
        $branch = Branch::factory()->create();
        $room = Room::factory()->create(['branch_id' => $branch->id]);
        $rate = RoomRate::factory()->create(['room_id' => $room->id]);
        foreach (['branches' => $branch->id, 'rooms' => $room->id, 'room_rates' => $rate->id] as $table => $id) {
            DB::table($table)->where('id', $id)->update(['is_active' => false, 'deleted_at' => now()]);
        }
        foreach (['branches' => $branch->id, 'rooms' => $room->id, 'rates' => $rate->id] as $path => $id) {
            $this->deleteJson('/api/v1/'.$path.'/'.$id)->assertNotFound();
            $this->postJson('/api/v1/'.$path.'/'.$id.'/restore')->assertNotFound();
            $this->getJson('/api/v1/'.$path.'?trashed=only')->assertJsonCount(0, 'data');
        }
        $user = User::factory()->create();
        $foreign->users()->attach($user, ['role' => 'employee']);
        $this->deleteJson('/api/v1/members/'.$user->id)->assertNotFound();
        $this->postJson('/api/v1/members/'.$user->id.'/restore')->assertNotFound();
    }

    public function test_room_can_move_to_an_authorized_branch_without_changing_prices(): void
    {
        $target = $this->postJson('/api/v1/branches', ['name' => 'Destino'])->assertCreated()->json('data.id');
        $rate = $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/rooms/'.$this->room->id, ['branch_id' => $target])->assertOk()->assertJsonPath('data.branch_id', $target);
        $this->assertDatabaseHas('room_rates', ['id' => $rate, 'room_id' => $this->room->id, 'hourly_price' => '20.00', 'is_active' => true]);
    }

    public function test_inactive_parent_blocks_room_activation_and_prices(): void
    {
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertStatus(409);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/deactivate')->assertOk();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/activate')->assertStatus(409);
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', $this->rate())->assertStatus(409);
        $this->postJson('/api/v1/branches/'.$this->branch->id.'/activate')->assertOk();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/activate')->assertOk();
    }

    public function test_trash_metadata_is_never_accepted_from_forms(): void
    {
        $this->patchJson('/api/v1/rooms/'.$this->room->id, ['deleted_at' => now()->toISOString()])->assertUnprocessable();
        $this->patchJson('/api/v1/branches/'.$this->branch->id, ['deleted_at' => now()->toISOString()])->assertUnprocessable();
        $this->patchJson('/api/v1/members/'.$this->owner->id, ['removed_at' => now()->toISOString()])->assertUnprocessable();
        $this->postJson('/api/v1/rooms/'.$this->room->id.'/rates', [...$this->rate(), 'deleted_at' => now()->toISOString()])->assertUnprocessable();
    }

    private function rate(string $price = '20.00'): array
    {
        return ['name' => 'Precio estándar', 'hourly_price' => $price, 'currency' => 'USD'];
    }
}
