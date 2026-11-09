<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'deleted_at' => $this->deleted_at, 'name' => $this->name, 'address' => $this->address, 'is_active' => $this->is_active, 'created_at' => $this->created_at, 'updated_at' => $this->updated_at];
    }
}
