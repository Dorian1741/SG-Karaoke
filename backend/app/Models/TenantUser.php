<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class TenantUser extends Pivot
{
    protected $table = 'tenant_user';

    public $incrementing = false;

    protected $fillable = ['tenant_id', 'user_id', 'role', 'is_active', 'removed_at'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'removed_at' => 'datetime'];
    }
}
