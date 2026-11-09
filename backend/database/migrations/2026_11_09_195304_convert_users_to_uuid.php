<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE TEMP TABLE user_uuid_map ON COMMIT DROP AS SELECT id AS old_id, gen_random_uuid() AS new_id FROM users');
        DB::statement('ALTER TABLE users ADD COLUMN new_uuid uuid');
        DB::statement('UPDATE users SET new_uuid = user_uuid_map.new_id FROM user_uuid_map WHERE users.id = user_uuid_map.old_id');
        DB::statement('ALTER TABLE sessions ADD COLUMN new_user_uuid uuid');
        DB::statement('UPDATE sessions SET new_user_uuid = user_uuid_map.new_id FROM user_uuid_map WHERE sessions.user_id = user_uuid_map.old_id');
        DB::statement('ALTER TABLE sessions DROP COLUMN user_id');
        DB::statement('ALTER TABLE sessions RENAME COLUMN new_user_uuid TO user_id');
        DB::statement('CREATE INDEX sessions_user_id_index ON sessions(user_id)');
        DB::statement('ALTER TABLE users DROP COLUMN id');
        DB::statement('ALTER TABLE users RENAME COLUMN new_uuid TO id');
        DB::statement('ALTER TABLE users ALTER COLUMN id SET NOT NULL');
        DB::statement('ALTER TABLE users ADD PRIMARY KEY (id)');
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_active')->default(true);
        });
        DB::statement('CREATE UNIQUE INDEX users_email_case_insensitive ON users(lower(email))');
        DB::statement('ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        throw new RuntimeException('UUID conversion preserves data and cannot be reversed automatically. Restore a reviewed backup.');
    }
};
