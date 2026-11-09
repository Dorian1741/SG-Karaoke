<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\PaginatesTenantRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoomRequest;
use App\Http\Resources\RoomResource;
use App\Models\Room;
use App\Services\RoomService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class RoomController extends Controller
{
    use PaginatesTenantRecords;

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Room::class);
        $query = $this->filtered($request, Room::query()->with(['branch', 'activeRate']));
        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->input('branch_id'));
        }
        if ($request->filled('operational_status')) {
            $query->where('operational_status', $request->input('operational_status'));
        }

        return RoomResource::collection($query->orderBy('name')->orderBy('id')->paginate($request->integer('per_page', 20)));
    }

    public function store(RoomRequest $request, RoomService $service): RoomResource
    {
        Gate::authorize('create', Room::class);

        return new RoomResource($service->create($request->validated()));
    }

    public function show(Room $room): RoomResource
    {
        Gate::authorize('view', $room);

        return new RoomResource($room->load(['branch', 'activeRate']));
    }

    public function update(RoomRequest $request, Room $room, RoomService $service): RoomResource
    {
        Gate::authorize('update', $room);
        $room = $service->update($room, $request->validated());

        return new RoomResource($room);
    }

    public function deactivate(Room $room, RoomService $service): RoomResource
    {
        Gate::authorize('update', $room);
        $room = $service->setActive($room, false);

        return new RoomResource($room);
    }

    public function activate(Room $room, RoomService $service): RoomResource
    {
        Gate::authorize('update', $room);

        return new RoomResource($service->setActive($room, true));
    }

    public function destroy(Room $room, RoomService $service): Response
    {
        Gate::authorize('delete', $room);
        $service->delete($room);

        return response()->noContent();
    }

    public function restore(Room $room, RoomService $service): RoomResource
    {
        Gate::authorize('restore', $room);

        return new RoomResource($service->restore($room));
    }
}
