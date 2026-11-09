<?php

namespace App\Policies;

use App\Models\TenantUser;
use App\Models\User;
use App\Support\TenantContext;

class TenantUserPolicy
{
    public function viewAny(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && $context->role === 'owner';
    }

    public function view(User $user, TenantUser $record): bool
    {
        return $this->viewAny($user) && $record->tenant_id === app(TenantContext::class)->id();
    }

    public function create(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && $context->role === 'owner';
    }

    public function update(User $user, TenantUser $record): bool
    {
        return $this->create($user) && $record->tenant_id === app(TenantContext::class)->id();
    }

    public function delete(User $user, TenantUser $record): bool
    {
        return $this->update($user, $record);
    }

    public function restore(User $user, TenantUser $record): bool
    {
        return $this->update($user, $record);
    }
}
