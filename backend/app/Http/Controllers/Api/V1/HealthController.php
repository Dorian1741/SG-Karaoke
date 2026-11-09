<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection('pgsql')->select('SELECT 1');
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'status' => 'error',
                'service' => 'KaraokeOS API',
                'database' => 'unavailable',
            ], 503);
        }

        return response()->json([
            'status' => 'ok',
            'service' => 'KaraokeOS API',
            'database' => 'connected',
        ]);
    }
}
