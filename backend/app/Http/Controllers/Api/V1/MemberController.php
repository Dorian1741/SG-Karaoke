<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MemberRequest;
use App\Http\Resources\MemberResource;
use App\Models\TenantUser;
use App\Services\MembershipService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class MemberController extends Controller
{
    public function index(Request $request, TenantContext $context): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', TenantUser::class);
        $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100'], 'page' => ['sometimes', 'integer', 'min:1'], 'trashed' => ['sometimes', 'in:only']]);
        $query = $context->tenant->users();
        if ($request->filled('trashed')) {
            $query->wherePivotNotNull('removed_at');
        } else {
            $query->wherePivotNull('removed_at');
        }

        return MemberResource::collection($query->orderBy('name')->orderBy('users.id')->paginate($request->integer('per_page', 20)));
    }

    public function store(MemberRequest $request, MembershipService $service): JsonResponse
    {
        Gate::authorize('create', TenantUser::class);

        return (new MemberResource($service->add($request->validated())))->response()->setStatusCode(201);
    }

    public function update(MemberRequest $request, string $member, MembershipService $service): MemberResource
    {
        Gate::authorize('create', TenantUser::class);

        return new MemberResource($service->update($member, $request->validated()));
    }

    public function destroy(string $member, MembershipService $service, TenantContext $context): Response
    {
        Gate::authorize('create', TenantUser::class);
        $record = $context->tenant->users()->where('users.id', $member)->wherePivotNull('removed_at')->firstOrFail();
        Gate::authorize('delete', $record->pivot);
        $service->delete($member);

        return response()->noContent();
    }

    public function restore(string $member, MembershipService $service, TenantContext $context): MemberResource
    {
        Gate::authorize('create', TenantUser::class);
        $record = $context->tenant->users()->where('users.id', $member)->firstOrFail();
        Gate::authorize('restore', $record->pivot);

        return new MemberResource($service->restore($member));
    }
}
