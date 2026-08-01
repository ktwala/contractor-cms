import { createHash } from 'node:crypto';

/** Canonicalize JSON for stable hashing (sorted object keys, deep). */
export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => canonicalizeJson(v));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = canonicalizeJson(obj[k]);
  }
  return out;
}

/** GOV-7A — deterministic hash for impact preview and POST verification (excludes approval_reference). */
export function computeGovernancePolicyImpactPayloadHash(parts: {
  policy_key: string;
  scope: string;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  current_value: unknown;
  effective_from_iso: string;
}): string {
  const payload = {
    current_value: canonicalizeJson(parts.current_value),
    effective_from: parts.effective_from_iso,
    legal_entity_id: parts.legal_entity_id,
    pay_group_id: parts.pay_group_id,
    policy_key: parts.policy_key,
    scope: parts.scope,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
