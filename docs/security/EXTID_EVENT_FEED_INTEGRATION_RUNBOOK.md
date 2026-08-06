# EXTID Event Feed — Integration Runbook

**PR:** `PR-EXTID-FEED-RUNBOOK-1`
**Status:** `ACTIVE`
**Implements:** [`PR-EXTID-EVENT-FEED-1`](../../backend/src/core/extid/) (CLOSED)
**Doctrine:** [`ADR-EXTID-001`](./ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) §6–6.1

---

## 1. Purpose and boundary

The External Workforce Platform is the **publisher** of external workforce truth. Your IGA platform (e.g. Soffid) or an **integration middleware** owned by the IGA team is the **consumer and executor**.

```text
EWP          →  publishes immutable workforce events (outbox)
IGA / middleware  →  pulls, interprets, provisions, certifies, revokes
```

**EWP does not:**

- Create or update identities in target systems
- Assign application roles or entitlements
- Run SoD, certification campaigns, or approval workflows
- Report provisioning success as “access enabled” in the workforce plane

**EWP does:**

- Expose a **secure pull API** over durable `IgaOutboxEvent` rows
- Record **ack** (`SENT`) or **fail** (`FAILED` + reason) from the consumer
- Audit list / read / ack / fail operations

Push webhooks, message buses, and in-platform delivery adapters are **out of scope** until explicitly scheduled (e.g. `PR-EXTID-EVENT-DELIVERY-1`). **Use this pull feed for v1 integrations.**

---

## 2. Architecture (current)

```text
┌─────────────────────┐         pull (HTTPS)          ┌──────────────────────┐
│  External Workforce │  GET  /extid/events           │  IGA or middleware   │
│  Platform           │  GET  /extid/events/:id       │  (consumer)          │
│  (publisher)        │  POST /extid/events/:id/ack   │                      │
│  IgaOutboxEvent     │  POST /extid/events/:id/fail  │  → Soffid / AD / …  │
└─────────────────────┘                               └──────────────────────┘
```

| Plane | Owner | This API |
|-------|--------|----------|
| Workforce truth | EWP | Events + payloads |
| Accountability | EWP + HCM refs | `sponsorEmployeeId` in payload |
| Access execution | IGA | **Not** EWP — consumer decides |

---

## 3. Base URL and versioning

| Item | Value |
|------|--------|
| Global prefix | `api/v1` (env: `API_PREFIX`, default `api/v1`) |
| Feed base path | `/api/v1/extid/events` |
| Event contract | v1 — [`IgaOutboundExternalWorkforceEventV1`](../../backend/src/core/iga/iga-event.types.ts) |
| OpenAPI | Swagger UI when enabled — tag **api-key** for `X-API-Key` |

Example host: `https://ewp.example.com/api/v1/extid/events`

---

## 4. Authentication

Each request must authenticate as an **integration client**. Two mechanisms are supported:

| Method | Header | When to use |
|--------|--------|-------------|
| **API key (recommended)** | `X-API-Key: cms_<secret>` | Production IGA/middleware jobs |
| **JWT** | `Authorization: Bearer <token>` | Break-glass / admin testing only |

Query-string `api_key` is supported but **discouraged** (logs, referrer leakage).

### 4.1 Required permissions (scopes)

API keys use the `scopes` array on the `ApiKey` record. JWT users need the same strings on an assigned role.

| Permission | Purpose |
|------------|---------|
| `extid-events:read` | List and read events |
| `extid-events:ack` | Mark event consumed (`SENT`) |
| `extid-events:fail` | Mark event failed with reason |

Wildcards follow platform RBAC rules (`*:*`, `extid-events:*` if granted).

**Least privilege:** grant only the scopes your job needs (e.g. read-only poller vs ack worker).

---

## 5. Creating an integration API key

There is **no public self-service UI** for API keys in v1. Platform operators create keys through controlled procedures.

### 5.1 Operational model

Keys are stored hashed (`keyHash`); the plaintext value is shown **once** at creation. Prefix format: `cms_` + random hex (see `ApiKeyService.generateApiKey`).

| Field | Meaning |
|-------|---------|
| `name` | Human label (e.g. `Soffid PROD pull`) |
| `scopes` | String array — include the three `extid-events:*` permissions for full consume flow |
| `organizationId` | `null` = **global** integration client; UUID = **tenant-scoped** client |
| `createdBy` | Admin user id (audit) |
| `expiresAt` | Optional expiry |
| `isActive` | Revoke by setting `false` |

**Environment:** `API_KEY_SALT` must be set consistently across all platform instances that validate keys.

### 5.2 Example — programmatic creation (Nest bootstrap)

Use this pattern in a one-off admin script or maintenance task (not in the request path):

```typescript
// Pseudocode — run inside a trusted Nest/Prisma context
const { apiKey, record } = await apiKeyService.generateApiKey({
  name: 'Soffid integration — production',
  scopes: ['extid-events:read', 'extid-events:ack', 'extid-events:fail'],
  organizationId: '<tenant-uuid>', // or omit / null for global
  createdBy: '<admin-user-uuid>',
  expiresAt: new Date('2027-12-31'),
});
// Store apiKey in your secret manager immediately; it cannot be retrieved again.
```

### 5.3 JWT alternative

Assign a dedicated role (e.g. `IGA_INTEGRATION`) with `extid-events:read`, `extid-events:ack`, and `extid-events:fail`. Prefer **API keys** for machine-to-machine traffic so workforce feed access is not coupled to human session JWTs.

---

## 6. Tenant-scoped vs global integration client

Outbox rows carry `organizationId` (set when events are written from contractor/engagement mutations).

| API key `organizationId` | Visible events |
|--------------------------|----------------|
| **Set** (tenant UUID) | Only rows where `organizationId` matches |
| **Null** (global) | All tenants’ events |

**Legacy rows** with `organizationId = null` are visible only to **global** clients until backfilled.

**Recommendation:**

- **Production Soffid per tenant:** one API key per `organizationId`.
- **Central integration hub:** global key only with network controls and strict ops approval.

---

## 7. API reference (consumer)

### 7.1 List events

```http
GET /api/v1/extid/events?status=PENDING&limit=50&cursor=<uuid>
X-API-Key: cms_...
```

| Query | Default | Notes |
|-------|---------|--------|
| `status` | `PENDING` | `PENDING` \| `SENT` \| `FAILED` |
| `limit` | `50` | Max `50` |
| `cursor` | — | Previous page `nextCursor` (outbox row id) |

**Response:**

```json
{
  "items": [ { /* ExtidEventResponse */ } ],
  "nextCursor": "uuid-or-null"
}
```

Ordering: oldest first (`createdAt`, then `id`).

### 7.2 Read one event

```http
GET /api/v1/extid/events/{id}
X-API-Key: cms_...
```

Use for idempotent re-fetch before ack or forensic replay.

### 7.3 Acknowledge (consumed)

```http
POST /api/v1/extid/events/{id}/ack
X-API-Key: cms_...
```

| From status | Result |
|-------------|--------|
| `PENDING` | → `SENT`, `lastAttemptAt` set, `failureReason` cleared |
| `SENT` | **200** — idempotent, unchanged |
| `FAILED` | **409** — cannot ack |

**Semantics:** `SENT` means the consumer has taken responsibility for the payload (delivered to IGA, persisted, or queued downstream). It does **not** mean Soffid finished provisioning.

### 7.4 Mark failed

```http
POST /api/v1/extid/events/{id}/fail
Content-Type: application/json
X-API-Key: cms_...

{ "reason": "Soffid rejected: unknown sponsorEmployeeId" }
```

| From status | Result |
|-------------|--------|
| `PENDING` | → `FAILED`, `failureReason` set |
| `SENT` | **409** — cannot fail |
| `FAILED` | Overwrites reason (operational re-drive) |

`reason`: 1–2000 characters.

### 7.5 Event body shape (`ExtidEventResponse`)

| Field | Description |
|-------|-------------|
| `id` | Outbox row id (use for ack/fail URLs) |
| `organizationId` | Tenant scope |
| `eventType` | e.g. `EXTERNAL_PERSON_CREATED` |
| `eventVersion` | Contract version (currently `1`) |
| `source` | `contractor-cms` |
| `externalPersonId` | Platform correlation id |
| `payload` | **Immutable** v1 envelope (see §8) |
| `deliveryStatus` | `PENDING` \| `SENT` \| `FAILED` |
| `failureReason` | Set when failed |
| `createdAt` | ISO-8601 |
| `lastAttemptAt` | ISO-8601 or null |

---

## 8. Payload contract (v1)

Canonical types: [`iga-event.types.ts`](../../backend/src/core/iga/iga-event.types.ts).

**Event types currently written to the outbox** (mutation-driven):

| `eventType` | Trigger (summary) |
|-------------|---------------------|
| `EXTERNAL_PERSON_CREATED` | Contractor create |
| `EXTERNAL_PERSON_UPDATED` | Contractor update |
| `EXTERNAL_PERSON_SPONSOR_ASSIGNED` | Engagement sponsor assign/change |

Other names in the catalog (`SUSPENDED`, `TERMINATED`, etc.) are reserved for future writes.

**Example payload** (inside `payload`):

```json
{
  "version": 1,
  "source": "contractor-cms",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "EXTERNAL_PERSON_CREATED",
  "occurredAt": "2026-05-16T12:00:00.000Z",
  "externalPersonId": null,
  "contractorId": "…",
  "engagementId": null,
  "personType": null,
  "workerArchetype": null,
  "supplierId": "…",
  "sponsorEmployeeId": null,
  "sponsorStatus": null,
  "accessIntent": null,
  "riskTier": null,
  "igaIntegrationStatus": "IGA_UNKNOWN"
}
```

**Consumer mapping:** translate this envelope into your IGA’s identity model, correlation keys, and workflows. EWP does not dictate Soffid object types or attribute names.

---

## 9. Recommended pull / ack / fail flow

```text
loop (scheduled poller):
  1. GET /extid/events?status=PENDING&limit=50&cursor=...
  2. For each item:
       a. Validate payload + tenant (organizationId)
       b. POST to IGA (your code) — create/update identity, sponsor link, etc.
       c. On IGA success → POST /extid/events/{id}/ack
       d. On permanent IGA error → POST /extid/events/{id}/fail { reason }
  3. If nextCursor present, continue with cursor until empty
```

**Idempotency:**

- Use `payload.eventId` + `contractorId` in your consumer as a dedupe key.
- Safe to **re-read** the same outbox `id`; ack is idempotent when already `SENT`.
- Do **not** ack until IGA has accepted the message (or you have persisted it in your middleware dead-letter store).

**At-least-once:** assume duplicates if your poller crashes after IGA write but before ack. IGA side must tolerate replays.

---

## 10. Consumer responsibilities (IGA / middleware)

| Responsibility | Owner |
|----------------|--------|
| Poll frequency and batching | Consumer |
| Map `sponsorEmployeeId` to HCM/HR identity | Consumer |
| Decide create vs update vs disable account | Consumer |
| Entitlements, roles, SoD, certification | Consumer (IGA) |
| Physical / logical access execution | Consumer (IGA) |
| Retry and dead-letter policy | Consumer |
| Ack / fail callbacks to EWP | Consumer |

EWP **`SENT`** = “consumer took the event.” EWP **`FAILED`** = “consumer could not process; ops may investigate.” Neither status implies provisioning completed in AD or Soffid.

---

## 11. Security guidance

| Control | Guidance |
|---------|----------|
| **Transport** | HTTPS only in production; prefer private network or VPN between platform and middleware |
| **mTLS** | Recommended where enterprise PKI is available (terminate at gateway) |
| **IP allowlist** | Enforce at API gateway / WAF — platform does not replace network zoning |
| **Secrets** | Store `ewp_*` keys in a vault; rotate on compromise; never commit to repos |
| **Scopes** | Minimum scopes; separate read-only monitors from ack workers if possible |
| **Tenant keys** | Prefer per-`organizationId` keys over global keys |
| **Audit** | The platform logs `EXTID_EVENTS_LISTED`, `EXTID_EVENT_READ`, `EXTID_EVENT_ACKED`, `EXTID_EVENT_FAILED` — correlate with your IGA audit trail |
| **Human JWT** | Avoid long-lived service accounts sharing user passwords |

---

## 12. Troubleshooting

### HTTP 401 Unauthorized

- Missing or invalid `X-API-Key` / JWT
- Key revoked (`isActive = false`) or expired (`expiresAt`)
- Wrong `API_KEY_SALT` on the platform instance

### HTTP 403 Forbidden

- API key missing required scope (e.g. ack without `extid-events:ack`)
- JWT role lacks permission

### HTTP 404 Not found

- Wrong event `id`
- Event belongs to another tenant and key is **tenant-scoped**

### HTTP 400 Bad request

- Invalid `cursor` (unknown id or wrong tenant visibility)
- Invalid `fail` body (empty `reason`, too long)

### HTTP 409 Conflict

- Ack on `FAILED` event
- Fail on `SENT` event

### Events stuck in `PENDING`

| Check | Action |
|-------|--------|
| Poller not running | Start middleware schedule; verify connectivity |
| Ack never called | Fix consumer bug; ack after successful IGA handoff |
| Wrong tenant scope | Use correct `organizationId` on API key |
| Internal dispatcher | If `IGA_DISPATCH_ENABLED=true`, EWP stub dispatcher may move rows — **disable** in production when IGA pull is authoritative |

### Events in `FAILED`

1. Read `failureReason` via GET by id.
2. Fix data in EWP (sponsor, contractor) or mapping in middleware.
3. **The platform does not auto-requeue** failed rows in v1 — coordinate with platform ops (new mutation may emit a new event, or manual re-drive policy TBD).

### Duplicate processing in IGA

- Expected under at-least-once delivery; dedupe on `payload.eventId`.

### Auditing integration activity

- EWP: Audit logs / settings → audit logs; filter actions `EXTID_*`
- Include `metadata.apiKeyId` where applicable

---

## 13. Related documentation

| Document | Topic |
|----------|--------|
| [`ADR-EXTID-001`](./ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | Publisher vs consumer doctrine |
| [`AUDIT_EVENT_CATALOG.md`](./AUDIT_EVENT_CATALOG.md) | `EXTID_*` audit actions |
| [`RBAC_OPERATIONS_GUIDE.md`](./RBAC_OPERATIONS_GUIDE.md) | Permissions catalog and test DB |
| [`ROLE_TRANSITION_MATRIX_V1.md`](../business/ROLE_TRANSITION_MATRIX_V1.md) | PR traceability |
| [`backend/src/core/extid/`](../../backend/src/core/extid/) | Implementation |
| [`backend/test/extid-event-feed.e2e-spec.ts`](../../backend/test/extid-event-feed.e2e-spec.ts) | Executable contract examples |

---

## 14. Example session (curl)

Replace host, key, and ids.

```bash
export EWP_URL="https://ewp.example.com/api/v1"
export API_KEY="ewp_..."

# List pending
curl -sS -H "X-API-Key: $API_KEY" \
  "$EWP_URL/extid/events?status=PENDING&limit=50" | jq .

# Read one
EVENT_ID="<uuid-from-items[0].id>"
curl -sS -H "X-API-Key: $API_KEY" \
  "$CMS_URL/extid/events/$EVENT_ID" | jq .

# Ack after successful handoff to IGA
curl -sS -X POST -H "X-API-Key: $API_KEY" \
  "$CMS_URL/extid/events/$EVENT_ID/ack" | jq .

# Or fail with reason
curl -sS -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Soffid: sponsor not found in directory"}' \
  "$CMS_URL/extid/events/$EVENT_ID/fail" | jq .
```

---

## Changelog

| Version | Note |
|---------|------|
| 1.0 | **PR-EXTID-FEED-RUNBOOK-1** — initial integration runbook for pull feed (`PR-EXTID-EVENT-FEED-1`). |
