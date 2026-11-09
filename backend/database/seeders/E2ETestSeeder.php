<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class E2ETestSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('testing') || DB::selectOne('SELECT current_database() AS name')->name !== 'karaokeos_test') {
            throw new RuntimeException('Este seeder solo admite karaokeos_test en entorno testing.');
        }
        $password = getenv('E2E_PASSWORD');
        if (! $password || strlen($password) < 12) {
            throw new RuntimeException('Defina E2E_PASSWORD con al menos 12 caracteres. No hay contraseña predeterminada.');
        }
        DB::transaction(function () use ($password): void {
            $user = User::firstOrCreate(['email' => 'e2e-owner@example.test'], ['name' => 'Propietario E2E', 'password' => $password]);
            $user->update(['password' => $password]);
            $tenant = Tenant::firstOrCreate(['slug' => 'e2e'], ['name' => 'Establecimiento E2E']);
            $tenant->users()->syncWithoutDetaching([$user->id => ['role' => 'owner', 'is_active' => true]]);
        });
    }
}
