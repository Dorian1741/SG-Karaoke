<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

trait PaginatesTenantRecords
{
    protected function filtered(Request $request, Builder $query): Builder
    {
        $data = $request->validate([
            'trashed' => ['sometimes', 'in:only'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'branch_id' => ['sometimes', 'nullable', 'uuid'],
            'room_id' => ['sometimes', 'nullable', 'uuid'],
            'operational_status' => ['sometimes', 'in:available,cleaning,maintenance'],
        ]);
        if (isset($data['trashed'])) {
            Gate::authorize('create', $query->getModel()::class);
            $query->onlyTrashed();
        }
        if (! empty($data['search'])) {
            $query->where('name', 'ilike', '%'.$data['search'].'%');
        }
        if (isset($data['is_active'])) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $query;
    }
}
