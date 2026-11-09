<?php

namespace Database\Factories;

use App\Models\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoomFactory extends Factory
{
    public function definition(): array
    {
        return ['branch_id' => Branch::factory(), 'name' => fake()->word(), 'capacity' => 6, 'operational_status' => 'available', 'is_active' => true];
    }
}
