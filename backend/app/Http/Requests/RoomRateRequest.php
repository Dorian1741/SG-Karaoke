<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomRateRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'hourly_price' => ['required', 'string', 'regex:/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/'],
            'currency' => ['required', Rule::in(['USD'])],
            'room_id' => ['prohibited'],
            'is_active' => ['prohibited'],
        ];
    }
}
