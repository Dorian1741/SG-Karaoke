<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class ProvisionTenant extends Command
{
    protected $signature = 'karaokeos:provision {name} {slug} {email} {--timezone=America/Guayaquil}';

    protected $description = 'Crear una empresa y su propietario de forma privada e interactiva';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Se requiere una terminal interactiva para solicitar la contraseña de forma segura.');

            return self::FAILURE;
        }
        $email = strtolower($this->argument('email'));
        $existing = User::where('email', $email)->first();
        $password = $existing ? null : $this->secret('Contraseña del propietario (mínimo 12 caracteres, mayúsculas, minúsculas y números)');
        $data = ['name' => $this->argument('name'), 'slug' => $this->argument('slug'), 'email' => $email,
            'timezone' => $this->option('timezone'), 'password' => $password];
        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'alpha_dash:ascii', 'lowercase', 'max:255', 'unique:tenants,slug'],
            'email' => ['required', 'email', 'max:255'],
            'timezone' => ['required', 'timezone'],
            'password' => $existing ? ['nullable'] : ['required', Password::min(12)->mixedCase()->numbers()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }
        if ($existing && ! $existing->is_active) {
            $this->error('El usuario existente está desactivado.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($data, $existing): void {
            $tenant = Tenant::create(array_intersect_key($data, array_flip(['name', 'slug', 'timezone'])));
            $owner = $existing ?? User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']]);
            $tenant->users()->attach($owner->id, ['role' => 'owner', 'is_active' => true]);
        });
        $this->info('Establecimiento y propietario configurados.');

        return self::SUCCESS;
    }
}
