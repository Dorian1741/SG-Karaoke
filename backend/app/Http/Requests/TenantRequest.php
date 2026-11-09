<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;

class TenantRequest extends FormRequest
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
            'id' => ['prohibited'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'timezone' => ['sometimes', 'required', 'timezone'],
            'slug' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }
}
