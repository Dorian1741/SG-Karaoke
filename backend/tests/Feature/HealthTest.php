<?php

namespace Tests\Feature;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Mockery;
use PDOException;
use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_returns_success_when_postgresql_is_available(): void
    {
        $connection = Mockery::mock(Connection::class);
        DB::shouldReceive('connection')->once()->with('pgsql')->andReturn($connection);
        $connection->shouldReceive('select')->once()->with('SELECT 1')->andReturn([(object) ['?column?' => 1]]);

        $this->getJson('/api/v1/health')->assertOk()->assertExactJson([
            'status' => 'ok',
            'service' => 'KaraokeOS API',
            'database' => 'connected',
        ]);
    }

    public function test_health_returns_service_unavailable_without_exposing_connection_details(): void
    {
        DB::shouldReceive('connection')->once()->with('pgsql')
            ->andThrow(new PDOException('sensitive connection details'));

        $this->getJson('/api/v1/health')->assertStatus(503)->assertExactJson([
            'status' => 'error',
            'service' => 'KaraokeOS API',
            'database' => 'unavailable',
        ]);
    }
}
