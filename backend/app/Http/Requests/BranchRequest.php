<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;

class BranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app(TenantContext::class)->canManage();
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'tenant_id' => ['prohibited'],
            'deleted_at' => ['prohibited'],
            'removed_at' => ['prohibited'],
            'id' => ['prohibited'],
            'name' => [$required, 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['prohibited'],
        ];
    }
}
