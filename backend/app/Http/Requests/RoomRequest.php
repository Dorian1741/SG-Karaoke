<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomRequest extends FormRequest
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
            'branch_id' => [$required, 'uuid', Rule::exists('branches', 'id')->where('tenant_id', app(TenantContext::class)->id())->where('is_active', true)->whereNull('deleted_at')],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'capacity' => [$required, 'integer', 'min:1', 'max:10000'],
            'operational_status' => ['sometimes', Rule::in(['available', 'cleaning', 'maintenance'])],
            'is_active' => ['prohibited'],
        ];
    }
}
