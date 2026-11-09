<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Room;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(TenantContext $context): JsonResponse
    {
        return response()->json(['data' => [
            'tenant' => $context->tenant->only(['id', 'name', 'timezone']),
            'role' => $context->role,
            'branches' => Branch::count(),
            'rooms' => Room::count(),
            'available_rooms' => Room::where('is_active', true)->where('operational_status', 'available')
                ->whereHas('branch', fn ($query) => $query->where('is_active', true)->whereNull('branches.deleted_at'))->count(),
        ]]);
    }
}
