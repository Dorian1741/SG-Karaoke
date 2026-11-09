<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToTenant
{
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $builder->where($builder->getModel()->qualifyColumn('tenant_id'), app(TenantContext::class)->id());
        });
        static::creating(function ($model): void {
            $tenantId = app(TenantContext::class)->id();
            abort_if($model->tenant_id && $model->tenant_id !== $tenantId, 403);
            $model->tenant_id = $tenantId;
        });
        static::updating(function ($model): void {
            abort_if($model->tenant_id !== app(TenantContext::class)->id() || $model->isDirty('tenant_id'), 403);
        });
    }
}
