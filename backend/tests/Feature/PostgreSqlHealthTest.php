<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('integration')]
class PostgreSqlHealthTest extends TestCase
{
    public function test_health_connects_to_real_postgresql(): void
    {
        $this->getJson('/api/v1/health')->assertOk()
            ->assertJsonPath('database', 'connected');
    }
}
