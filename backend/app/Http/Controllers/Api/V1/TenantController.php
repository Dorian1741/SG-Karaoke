<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\TenantRequest;
use App\Http\Resources\TenantResource;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TenantResource::collection($request->user()->tenants()->wherePivot('is_active', true)->where('tenants.status', 'active')->orderBy('name')->get());
    }

    public function select(Request $request): JsonResponse
    {
        $data = $request->validate(['tenant_id' => ['required', 'uuid']]);
        $tenant = $request->user()->tenants()->where('tenants.id', $data['tenant_id'])
            ->wherePivot('is_active', true)->where('tenants.status', 'active')->firstOrFail();
        $request->session()->put('active_tenant_id', $tenant->id);
        $request->session()->regenerate();

        return response()->json(['data' => new TenantResource($tenant), 'message' => 'Establecimiento seleccionado.']);
    }

    public function show(TenantContext $context): TenantResource
    {
        Gate::authorize('view', $context->tenant);

        return new TenantResource($context->tenant);
    }

    public function update(TenantRequest $request, TenantContext $context): TenantResource
    {
        Gate::authorize('update', $context->tenant);
        $context->tenant->update($request->validated());

        return new TenantResource($context->tenant);
    }
}
