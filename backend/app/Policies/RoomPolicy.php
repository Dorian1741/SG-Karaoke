<?php

namespace App\Policies;

use App\Models\Room;
use App\Models\User;
use App\Support\TenantContext;

class RoomPolicy
{
    public function viewAny(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && true;
    }

    public function view(User $user, Room $record): bool
    {
        return $this->viewAny($user) && $record->tenant_id === app(TenantContext::class)->id();
    }

    public function create(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && $context->canManage();
    }

    public function update(User $user, Room $record): bool
    {
        return $this->create($user) && $record->tenant_id === app(TenantContext::class)->id();
    }

    public function delete(User $user, Room $record): bool
    {
        return $this->update($user, $record);
    }

    public function restore(User $user, Room $record): bool
    {
        return $this->update($user, $record);
    }
}
