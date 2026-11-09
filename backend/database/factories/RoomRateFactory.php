<?php

namespace Database\Factories;

use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoomRateFactory extends Factory
{
    public function definition(): array
    {
        return ['room_id' => Room::factory(), 'name' => 'Tarifa estándar', 'hourly_price' => '20.00', 'currency' => 'USD', 'is_active' => true];
    }
}
