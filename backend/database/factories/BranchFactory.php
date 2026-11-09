<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class BranchFactory extends Factory
{
    public function definition(): array
    {
        return ['name' => fake()->company(), 'address' => fake()->address(), 'is_active' => true];
    }
}
