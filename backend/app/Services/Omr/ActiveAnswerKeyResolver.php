<?php

namespace App\Services\Omr;

use App\Models\AnswerKey;
use DomainException;

class ActiveAnswerKeyResolver
{
    public function __construct(private readonly AnswerKeyPayloadFactory $payloadFactory) {}

    /**
     * Resolve the one complete active key. Call inside a transaction when the
     * returned key will immediately be bound to an applicant.
     */
    public function resolve(): AnswerKey
    {
        $keys = AnswerKey::query()
            ->where('status', 'Active')
            ->with('items')
            ->lockForUpdate()
            ->limit(2)
            ->get();

        if ($keys->isEmpty()) {
            throw new DomainException('No active answer key is configured. Ask an administrator to activate one.');
        }

        if ($keys->count() !== 1) {
            throw new DomainException('More than one active answer key exists. An administrator must correct the key configuration.');
        }

        $key = $keys->first();
        $this->payloadFactory->make($key);

        return $key;
    }
}
