# Structured Error Codes — Backend Contract

The global `HttpExceptionFilter` in `src/common/filters/http-exception.filter.ts` returns
every error response in a consistent shape:

```json
{
  "code": "PAYROLL_LEGAL_ENTITY_REQUIRED",
  "message": "Human-readable explanation.",
  "details": {},
  "path": "/v1/payruns",
  "timestamp": "2026-03-17T12:00:00.000Z"
}
```

The `code` field is the stable contract. The frontend maps codes to UI behavior.

## How to throw structured errors

### Preferred: pass an object to the exception

```ts
throw new ForbiddenException({
  code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
  message: 'No legal entity access assigned to this user.',
});
```

The filter reads `resp.code` from the exception response object.

### Fallback: bare string

```ts
throw new ForbiddenException('Something went wrong');
```

The filter generates a generic code from the HTTP status (e.g., `FORBIDDEN` for 403).

### Why structured is better

The frontend classifies errors by `code`, not by HTTP status or message text.

- `FORBIDDEN` → shows "Access restricted" with lock icon
- `PAYROLL_LEGAL_ENTITY_REQUIRED` → shows "Setup required" with CTA button

A bare string 403 is treated as generic `FORBIDDEN`.
A structured code gives the frontend the ability to show targeted guidance.

## Registered codes

### Payroll readiness

| Code | HTTP | Meaning |
|------|------|---------|
| `PAYROLL_LEGAL_ENTITY_REQUIRED` | 403 | User has no legal entities assigned |
| `PAYROLL_LEGAL_ENTITY_DENIED` | 403 | User cannot access the specific legal entity |
| `PAYROLL_NO_PAY_GROUPS` | 403/422 | No pay groups configured |
| `PAYROLL_NO_EMPLOYEES` | 403/422 | No employees loaded |

### Generic (auto-derived from status)

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Generic permission denial |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Validation or input error |
| `UNAUTHORIZED` | 401 | Authentication required |
| `INTERNAL_ERROR` | 500 | Server error |

### Tax Table Authoring (TTA)

All TTA codes are prefixed with `TTA_` and defined in
`src/modules/tax-table-authoring/types/error-codes.ts`.

## Guidelines for backend contributors

1. **Prefer structured codes** over bare string exceptions for any
   readiness/business-rule/permission error.

2. **Use a domain prefix** for new codes: `PAYROLL_`, `ENTERPRISE_`, `COMPLIANCE_`, etc.

3. **Keep messages human-readable** — the frontend may display them as fallback text.

4. **Do not change message wording** for existing codes without coordinating with frontend.
   The frontend maps by `code`, not by `message`, but the message is still shown to users.

5. **Register new readiness codes** by adding them to the frontend's `BLOCKED_CODES` map
   in `admin-portal/src/utils/pageState.ts` so they render setup guidance instead of
   generic error banners.
