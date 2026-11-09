<?php

namespace App\Policies;

use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;

class TenantPolicy
{
    public function viewAny(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && true;
    }

    public function view(User $user, Tenant $record): bool
    {
        return $this->viewAny($user) && $record->id === app(TenantContext::class)->id();
    }

    public function create(User $user): bool
    {
        $context = app(TenantContext::class);

        return $context->tenant !== null && $context->role === 'owner';
    }

    public function update(User $user, Tenant $record): bool
    {
        return $this->create($user) && $record->id === app(TenantContext::class)->id();
    }
}
