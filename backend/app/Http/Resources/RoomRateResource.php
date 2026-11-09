<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomRateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'deleted_at' => $this->deleted_at, 'room_id' => $this->room_id, 'name' => $this->name, 'hourly_price' => $this->hourly_price, 'currency' => $this->currency, 'is_active' => $this->is_active, 'room' => $this->whenLoaded('room', fn () => ['id' => $this->room->id, 'name' => $this->room->name, 'deleted_at' => $this->room->deleted_at, 'is_active' => $this->room->is_active]), 'created_at' => $this->created_at, 'updated_at' => $this->updated_at];
    }
}
