<?php

namespace Tests;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;

abstract class DatabaseTestCase extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $actual = DB::selectOne('SELECT current_database() AS name')->name;
        if (! app()->environment('testing') || $actual !== 'karaokeos_test') {
            throw new RuntimeException('Las pruebas destructivas solo pueden ejecutarse en karaokeos_test.');
        }
    }
}
