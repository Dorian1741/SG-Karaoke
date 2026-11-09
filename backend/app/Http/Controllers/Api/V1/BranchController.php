<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\PaginatesTenantRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\BranchRequest;
use App\Http\Resources\BranchResource;
use App\Models\Branch;
use App\Services\BranchService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class BranchController extends Controller
{
    use PaginatesTenantRecords;

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Branch::class);
        $query = $this->filtered($request, Branch::query());

        return BranchResource::collection($query->orderBy('name')->orderBy('id')->paginate($request->integer('per_page', 20)));
    }

    public function store(BranchRequest $request): BranchResource
    {
        Gate::authorize('create', Branch::class);

        return new BranchResource(Branch::create($request->validated())->refresh());
    }

    public function show(Branch $branch): BranchResource
    {
        Gate::authorize('view', $branch);

        return new BranchResource($branch);
    }

    public function update(BranchRequest $request, Branch $branch): BranchResource
    {
        Gate::authorize('update', $branch);
        $branch->update($request->validated());

        return new BranchResource($branch);
    }

    public function deactivate(Branch $branch, BranchService $service): BranchResource
    {
        Gate::authorize('update', $branch);
        $branch = $service->setActive($branch, false);

        return new BranchResource($branch);
    }

    public function activate(Branch $branch, BranchService $service): BranchResource
    {
        Gate::authorize('update', $branch);

        return new BranchResource($service->setActive($branch, true));
    }

    public function destroy(Branch $branch, BranchService $service): Response
    {
        Gate::authorize('delete', $branch);
        $service->delete($branch);

        return response()->noContent();
    }

    public function restore(Branch $branch, BranchService $service): BranchResource
    {
        Gate::authorize('restore', $branch);

        return new BranchResource($service->restore($branch));
    }
}
