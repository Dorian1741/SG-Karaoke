<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'deleted_at' => $this->deleted_at, 'branch_id' => $this->branch_id, 'name' => $this->name, 'description' => $this->description, 'capacity' => $this->capacity, 'operational_status' => $this->operational_status, 'is_active' => $this->is_active, 'branch' => new BranchResource($this->whenLoaded('branch')), 'active_rate' => new RoomRateResource($this->whenLoaded('activeRate')), 'created_at' => $this->created_at, 'updated_at' => $this->updated_at];
    }
}
