<?php

namespace App\Support;

use App\Models\Tenant;

class TenantContext
{
    public ?Tenant $tenant = null;

    public ?string $role = null;

    public function id(): string
    {
        abort_unless($this->tenant, 403, 'Seleccione un establecimiento autorizado.');

        return $this->tenant->id;
    }

    public function canManage(): bool
    {
        return in_array($this->role, ['owner', 'admin'], true);
    }
}
