<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['branches', 'rooms', 'room_rates'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->softDeletes();
                $table->index(['tenant_id', 'deleted_at']);
            });
            DB::statement("ALTER TABLE {$tableName} ADD CONSTRAINT {$tableName}_deleted_inactive CHECK (deleted_at IS NULL OR NOT is_active)");
        }
        Schema::table('tenant_user', function (Blueprint $table): void {
            $table->timestamp('removed_at')->nullable();
            $table->index(['tenant_id', 'removed_at']);
        });
        DB::statement('ALTER TABLE tenant_user ADD CONSTRAINT tenant_user_removed_inactive CHECK (removed_at IS NULL OR NOT is_active)');
    }

    public function down(): void
    {
        foreach (['branches', 'rooms', 'room_rates'] as $tableName) {
            DB::statement("ALTER TABLE {$tableName} DROP CONSTRAINT {$tableName}_deleted_inactive");
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropIndex(['tenant_id', 'deleted_at']);
                $table->dropSoftDeletes();
            });
        }
        DB::statement('ALTER TABLE tenant_user DROP CONSTRAINT tenant_user_removed_inactive');
        Schema::table('tenant_user', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'removed_at']);
            $table->dropColumn('removed_at');
        });
    }
};
