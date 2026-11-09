<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\MemberController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\RoomRateController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\ResolveTenant;
use Illuminate\Support\Facades\Route;

foreach (['branch', 'room', 'rate', 'member'] as $parameter) {
    Route::pattern($parameter, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
}

Route::prefix('v1')->group(function (): void {
    Route::get('health', HealthController::class)->middleware('throttle:60,1')->name('api.v1.health');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware(['web', 'throttle:login']);
    Route::middleware(['auth:sanctum', EnsureActiveUser::class])->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('tenants', [TenantController::class, 'index']);
        Route::post('tenants/select', [TenantController::class, 'select']);
        Route::middleware(ResolveTenant::class)->group(function (): void {
            Route::get('dashboard', DashboardController::class);
            Route::get('tenant', [TenantController::class, 'show']);
            Route::patch('tenant', [TenantController::class, 'update']);
            Route::apiResource('branches', BranchController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
            Route::post('branches/{branch}/deactivate', [BranchController::class, 'deactivate'])->whereUuid('branch');
            Route::post('branches/{branch}/activate', [BranchController::class, 'activate'])->whereUuid('branch');
            Route::post('branches/{branch}/restore', [BranchController::class, 'restore'])->whereUuid('branch')->withTrashed();
            Route::apiResource('rooms', RoomController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
            Route::post('rooms/{room}/deactivate', [RoomController::class, 'deactivate'])->whereUuid('room');
            Route::post('rooms/{room}/activate', [RoomController::class, 'activate'])->whereUuid('room');
            Route::post('rooms/{room}/restore', [RoomController::class, 'restore'])->whereUuid('room')->withTrashed();
            Route::delete('rates/{rate}', [RoomRateController::class, 'destroy'])->whereUuid('rate');
            Route::post('rates/{rate}/restore', [RoomRateController::class, 'restore'])->whereUuid('rate')->withTrashed();
            Route::get('rates', [RoomRateController::class, 'index']);
            Route::post('rooms/{room}/rates', [RoomRateController::class, 'store'])->whereUuid('room');
            Route::post('rates/{rate}/replace', [RoomRateController::class, 'replace'])->whereUuid('rate');
            Route::delete('members/{member}', [MemberController::class, 'destroy'])->whereUuid('member');
            Route::post('members/{member}/restore', [MemberController::class, 'restore'])->whereUuid('member');
            Route::get('members', [MemberController::class, 'index']);
            Route::post('members', [MemberController::class, 'store']);
            Route::patch('members/{member}', [MemberController::class, 'update'])->whereUuid('member');
        });
    });
});
