<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\PaginatesTenantRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoomRateRequest;
use App\Http\Resources\RoomRateResource;
use App\Models\Room;
use App\Models\RoomRate;
use App\Services\RoomRateService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class RoomRateController extends Controller
{
    use PaginatesTenantRecords;

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', RoomRate::class);
        $query = $this->filtered($request, RoomRate::with('room'));
        if ($request->filled('room_id')) {
            $query->where('room_id', $request->input('room_id'));
        }

        return RoomRateResource::collection($query->orderByDesc('created_at')->orderBy('id')->paginate($request->integer('per_page', 20)));
    }

    public function store(RoomRateRequest $request, Room $room, RoomRateService $service): RoomRateResource
    {
        Gate::authorize('create', RoomRate::class);

        return new RoomRateResource($service->replace($room, $request->validated()));
    }

    public function replace(RoomRateRequest $request, RoomRate $rate, RoomRateService $service): RoomRateResource
    {
        Gate::authorize('update', $rate);
        abort_unless($rate->is_active, 409, 'La tarifa ya fue reemplazada.');

        return new RoomRateResource($service->replace($rate->room, $request->validated(), $rate->id));
    }

    public function destroy(RoomRate $rate, RoomRateService $service): Response
    {
        Gate::authorize('delete', $rate);
        $service->delete($rate);

        return response()->noContent();
    }

    public function restore(RoomRate $rate, RoomRateService $service): RoomRateResource
    {
        Gate::authorize('restore', $rate);

        return new RoomRateResource($service->restore($rate));
    }
}
