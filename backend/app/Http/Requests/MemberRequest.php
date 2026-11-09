<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class MemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app(TenantContext::class)->role === 'owner';
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'tenant_id' => ['prohibited'],
            'deleted_at' => ['prohibited'],
            'removed_at' => ['prohibited'],
            'id' => ['prohibited'],
            'email' => [$this->isMethod('post') ? 'required' : 'prohibited', 'email', 'lowercase', 'max:255'],
            'name' => [$this->isMethod('post') ? 'required' : 'prohibited', 'string', 'max:255'],
            'password' => [$this->isMethod('post') ? 'sometimes' : 'prohibited', 'string', Password::min(12)->mixedCase()->numbers()],
            'role' => [$required, Rule::in(['owner', 'admin', 'employee'])],
            'is_active' => ['sometimes', 'boolean'],
            'user_id' => ['prohibited'],
        ];
    }
}
