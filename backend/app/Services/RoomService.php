<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Room;
use App\Models\RoomRate;
use Closure;
use Illuminate\Support\Facades\DB;

class RoomService
{
    public function create(array $data): Room
    {
        return DB::transaction(function () use ($data): Room {
            $branch = Branch::whereKey($data['branch_id'])->lockForUpdate()->firstOrFail();
            abort_unless($branch->is_active, 409, 'Activa la sucursal antes de crear una sala.');

            return Room::create($data)->refresh();
        });
    }

    public function update(Room $room, array $data): Room
    {
        return DB::transaction(function () use ($room, $data): Room {
            $targetId = $data['branch_id'] ?? $room->branch_id;
            $branches = Branch::withTrashed()->whereIn('id', [$room->branch_id, $targetId])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $locked = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->branch_id === $room->branch_id, 409, 'La sala cambió de sucursal. Vuelve a cargarla.');
            if ($targetId !== $locked->branch_id) {
                $target = $branches->get($targetId);
                abort_unless($target && ! $target->trashed() && $target->is_active, 409, 'Elige una sucursal activa.');
            }
            $locked->update($data);

            return $locked;
        });
    }

    /** @param Closure(Room, Branch): mixed $operation */
    public function withLockedRoom(Room $room, Closure $operation): mixed
    {
        return DB::transaction(function () use ($room, $operation): mixed {
            $branch = Branch::withTrashed()->whereKey($room->branch_id)->lockForUpdate()->firstOrFail();
            $locked = Room::withTrashed()->whereKey($room->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->branch_id === $branch->id, 409, 'La sala cambió de sucursal. Vuelve a cargarla.');

            return $operation($locked, $branch);
        });
    }

    public function setActive(Room $room, bool $active): Room
    {
        return $this->withLockedRoom($room, function (Room $locked, Branch $branch) use ($active): Room {
            abort_if($locked->trashed(), 404);
            if ($active) {
                abort_unless(! $branch->trashed() && $branch->is_active, 409, 'Activa la sucursal antes de activar esta sala.');
            }
            $locked->update(['is_active' => $active]);

            return $locked;
        });
    }

    public function delete(Room $room): void
    {
        $this->withLockedRoom($room, function (Room $locked): void {
            abort_if($locked->trashed(), 404);
            RoomRate::where('room_id', $locked->id)->where('is_active', true)->update(['is_active' => false]);
            $locked->update(['is_active' => false]);
            $locked->delete();
        });
    }

    public function restore(Room $room): Room
    {
        return $this->withLockedRoom($room, function (Room $locked, Branch $branch): Room {
            abort_unless($locked->trashed(), 409, 'La sala ya está restaurada.');
            abort_unless(! $branch->trashed() && $branch->is_active, 409, 'Restaura y activa la sucursal antes de restaurar esta sala.');
            $locked->restore();

            return $locked;
        });
    }
}
