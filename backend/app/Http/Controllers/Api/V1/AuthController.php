<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $key = 'login:'.hash('sha256', strtolower($request->string('email')->toString()).'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Demasiados intentos. Intente nuevamente más tarde.'], 429)
                ->header('Retry-After', (string) RateLimiter::availableIn($key));
        }
        $credentials = $request->validated();
        $email = strtolower($credentials['email']);
        $credentials['email'] = fn (Builder $query) => $query->whereRaw('lower(email) = ?', [$email]);
        $credentials['is_active'] = true;
        if (! Auth::guard('web')->attempt($credentials)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => ['Credenciales incorrectas.']]);
        }
        RateLimiter::clear($key);
        $request->session()->regenerate();
        $request->session()->forget('active_tenant_id');
        $tenants = $request->user()->tenants()->wherePivot('is_active', true)->where('tenants.status', 'active')->get();
        if ($tenants->count() === 1) {
            $request->session()->put('active_tenant_id', $tenants->first()->id);
        }

        return $this->me($request);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => [
            'user' => $request->user()->only(['id', 'name', 'email']),
            'active_tenant_id' => $request->session()->get('active_tenant_id'),
        ]]);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
