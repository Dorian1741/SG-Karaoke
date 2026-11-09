<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $context = app(TenantContext::class);
        $tenant = $request->user()->tenants()->where('tenants.id', $request->session()->get('active_tenant_id'))
            ->where('tenants.status', 'active')->wherePivot('is_active', true)->first();
        abort_unless($tenant, 403, 'Seleccione un establecimiento autorizado.');
        $context->tenant = $tenant;
        $context->role = $tenant->pivot->role;

        try {
            return $next($request);
        } finally {
            $context->tenant = null;
            $context->role = null;
        }
    }
}
