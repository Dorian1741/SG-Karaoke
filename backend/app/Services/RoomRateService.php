<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Room;
use App\Models\RoomRate;

class RoomRateService
{
    public function __construct(private RoomService $rooms) {}

    public function replace(Room $room, array $data, ?string $expectedRateId = null): RoomRate
    {
        return $this->rooms->withLockedRoom($room, function (Room $lockedRoom, Branch $branch) use ($data, $expectedRateId): RoomRate {
            abort_unless(! $lockedRoom->trashed() && $lockedRoom->is_active && ! $branch->trashed() && $branch->is_active, 409, 'Activa la sala y su sucursal antes de configurar un precio.');
            if ($expectedRateId !== null) {
                abort_unless(RoomRate::whereKey($expectedRateId)->where('room_id', $lockedRoom->id)->where('is_active', true)->exists(), 409, 'El precio ya fue reemplazado. Vuelve a cargar el listado.');
            }
            RoomRate::where('room_id', $lockedRoom->id)->where('is_active', true)->update(['is_active' => false]);

            return RoomRate::create([...$data, 'room_id' => $lockedRoom->id, 'is_active' => true]);
        });
    }

    public function delete(RoomRate $rate): void
    {
        $this->rooms->withLockedRoom($rate->room, function () use ($rate): void {
            $locked = RoomRate::whereKey($rate->id)->lockForUpdate()->firstOrFail();
            $locked->update(['is_active' => false]);
            $locked->delete();
        });
    }

    public function restore(RoomRate $rate): RoomRate
    {
        return $this->rooms->withLockedRoom($rate->room, function (Room $room, Branch $branch) use ($rate): RoomRate {
            abort_if($room->trashed() || $branch->trashed(), 409, 'Restaura la sala y su sucursal antes de restaurar este precio.');
            $locked = RoomRate::withTrashed()->whereKey($rate->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->trashed(), 409, 'El precio ya está restaurado.');
            $locked->restore();

            return $locked;
        });
    }
}
