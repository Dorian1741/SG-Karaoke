<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MembershipService
{
    public function add(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $tenant = $this->lockTenant();
            $user = User::whereRaw('lower(email) = ?', [strtolower($data['email'])])->first();
            if (! $user) {
                if (empty($data['password'])) {
                    throw ValidationException::withMessages(['password' => ['Una cuenta nueva requiere contraseña.']]);
                }
                $user = User::firstOrCreate(['email' => strtolower($data['email'])], ['name' => $data['name'], 'password' => $data['password']]);
            }
            abort_unless($user->is_active, 409, 'Esta cuenta está desactivada. Contacta al administrador de la plataforma.');
            abort_if($tenant->users()->where('users.id', $user->id)->exists(), 409, 'La persona ya pertenece al negocio o está en su papelera. Revisa el equipo antes de agregarla.');
            $tenant->users()->attach($user->id, ['role' => $data['role'], 'is_active' => $data['is_active'] ?? true]);

            return $tenant->users()->where('users.id', $user->id)->firstOrFail();
        });
    }

    public function update(string $userId, array $data): User
    {
        return DB::transaction(function () use ($userId, $data): User {
            $tenant = $this->lockTenant();
            $member = $tenant->users()->where('users.id', $userId)->wherePivotNull('removed_at')->firstOrFail();
            $removesOwner = ($data['role'] ?? $member->pivot->role) !== 'owner' || ! ($data['is_active'] ?? $member->pivot->is_active);
            if ($removesOwner) {
                $this->ensureOwnerRemains($tenant, $member);
            }
            abort_if(($data['is_active'] ?? false) && ! $member->is_active, 409, 'La cuenta de esta persona está desactivada.');
            $tenant->users()->updateExistingPivot($userId, array_intersect_key($data, array_flip(['role', 'is_active'])));

            return $tenant->users()->where('users.id', $userId)->firstOrFail();
        });
    }

    public function delete(string $userId): void
    {
        DB::transaction(function () use ($userId): void {
            $tenant = $this->lockTenant();
            $member = $tenant->users()->where('users.id', $userId)->wherePivotNull('removed_at')->firstOrFail();
            $this->ensureOwnerRemains($tenant, $member);
            $tenant->users()->updateExistingPivot($userId, ['is_active' => false, 'removed_at' => now()]);
        });
    }

    public function restore(string $userId): User
    {
        return DB::transaction(function () use ($userId): User {
            $tenant = $this->lockTenant();
            $member = $tenant->users()->where('users.id', $userId)->firstOrFail();
            abort_unless($member->pivot->removed_at, 409, 'La persona ya está restaurada.');
            $tenant->users()->updateExistingPivot($userId, ['removed_at' => null, 'is_active' => false]);

            return $tenant->users()->where('users.id', $userId)->firstOrFail();
        });
    }

    private function lockTenant(): Tenant
    {
        return Tenant::whereKey(app(TenantContext::class)->id())->lockForUpdate()->firstOrFail();
    }

    private function ensureOwnerRemains(Tenant $tenant, User $member): void
    {
        if ($member->pivot->role === 'owner' && $member->pivot->is_active) {
            $otherOwners = $tenant->users()->where('users.id', '!=', $member->id)->where('users.is_active', true)
                ->wherePivot('role', 'owner')->wherePivot('is_active', true)->wherePivotNull('removed_at')->exists();
            abort_unless($otherOwners, 409, 'Debe conservar al menos un propietario activo.');
        }
    }
}
