<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Room;
use Illuminate\Support\Facades\DB;

class BranchService
{
    public function setActive(Branch $branch, bool $active): Branch
    {
        return DB::transaction(function () use ($branch, $active): Branch {
            $locked = Branch::whereKey($branch->id)->lockForUpdate()->firstOrFail();
            if (! $active) {
                abort_if(Room::where('branch_id', $locked->id)->where('is_active', true)->exists(), 409, 'Desactiva o mueve las salas activas antes de desactivar esta sucursal.');
            }
            $locked->update(['is_active' => $active]);

            return $locked;
        });
    }

    public function delete(Branch $branch): void
    {
        DB::transaction(function () use ($branch): void {
            $locked = Branch::whereKey($branch->id)->lockForUpdate()->firstOrFail();
            abort_if(Room::where('branch_id', $locked->id)->exists(), 409, 'Esta sucursal todavía tiene salas. Muévelas o envíalas a la papelera antes de eliminarla.');
            $locked->update(['is_active' => false]);
            $locked->delete();
        });
    }

    public function restore(Branch $branch): Branch
    {
        return DB::transaction(function () use ($branch): Branch {
            $locked = Branch::withTrashed()->whereKey($branch->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->trashed(), 409, 'La sucursal ya está restaurada.');
            $locked->restore();

            return $locked;
        });
    }
}
