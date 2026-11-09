<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'removed_at' => $this->pivot->removed_at, 'name' => $this->name, 'email' => $this->email, 'role' => $this->pivot->role, 'is_active' => $this->pivot->is_active, 'user_is_active' => $this->is_active];
    }
}
