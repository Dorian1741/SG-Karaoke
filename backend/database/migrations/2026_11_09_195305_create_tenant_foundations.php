<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active');
            $table->string('timezone')->default('America/Guayaquil');
            $table->timestamps();
        });
        Schema::create('tenant_user', function (Blueprint $table): void {
            $table->foreignUuid('tenant_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->string('role');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->primary(['tenant_id', 'user_id']);
            $table->index(['user_id', 'is_active']);
        });
        Schema::create('branches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'id']);
            $table->index(['tenant_id', 'is_active']);
        });
        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->restrictOnDelete();
            $table->uuid('branch_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('capacity');
            $table->string('operational_status')->default('available');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'id']);
            $table->foreign(['tenant_id', 'branch_id'])->references(['tenant_id', 'id'])->on('branches')->restrictOnDelete();
            $table->index(['tenant_id', 'branch_id']);
            $table->index(['tenant_id', 'is_active', 'operational_status']);
        });
        Schema::create('room_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->restrictOnDelete();
            $table->uuid('room_id');
            $table->string('name');
            $table->decimal('hourly_price', 12, 2);
            $table->char('currency', 3)->default('USD');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->foreign(['tenant_id', 'room_id'])->references(['tenant_id', 'id'])->on('rooms')->restrictOnDelete();
            $table->index(['tenant_id', 'room_id', 'created_at']);
        });
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive'))");
        DB::statement("ALTER TABLE tenant_user ADD CONSTRAINT tenant_user_role_check CHECK (role IN ('owner', 'admin', 'employee'))");
        DB::statement('ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_check CHECK (capacity > 0)');
        DB::statement("ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (operational_status IN ('available', 'cleaning', 'maintenance'))");
        DB::statement("ALTER TABLE room_rates ADD CONSTRAINT room_rates_price_check CHECK (hourly_price >= 0), ADD CONSTRAINT room_rates_currency_check CHECK (currency = 'USD')");
        DB::statement('CREATE UNIQUE INDEX room_rates_one_active_per_room ON room_rates(tenant_id, room_id) WHERE is_active');
    }

    public function down(): void
    {
        Schema::dropIfExists('room_rates');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('tenant_user');
        Schema::dropIfExists('tenants');
    }
};
