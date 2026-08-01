# Technical demo — evidence & edge paths

**Audience:** Engineering, integration, governance operators.  
**Logins:** `ops.admin@ewp.demo` (workforce storyline) · `workforce.import@ewp.demo` (Workforce Import) · see [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md)

Run **[`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md)** (*Managing an External Workforce*) as the narrative spine (~45–60 min with this appendix). For executive audiences, open with [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md) Phase 1 before Acts 1–6.

---

## Two-window combined flow

| Step | Operations (`ops.admin@ewp.demo`) | Supplier (`supplier.admin@ewp.demo`) |
|------|----------------------|------------------------------|
| Trust | `/suppliers`, `/suppliers/approvals` | — |
| Introduce | — | Nominate at `/supplier-portal/contractors` |
| Decide | `/contractors/workforce-review` | Refresh timeline on worker detail |
| Assign | `/engagements`, `/contracts` | — |
| Change | Suspend API or reject/blacklist | Supplier sees updated timeline |
| React | `/settings/audit-logs`, EXTID API | — |

---

## Exception paths (extra workers)

Nominate three workers up front:

| Worker | Path | Where |
|--------|------|--------|
| A | Happy path | Review → activate |
| B | Reject or send back | Workforce review |
| C | Blacklist | Workforce review (+ authority note) |

Supplier timeline after reject: rose banner + reason visible; authority notes hidden.

---

## Suspend / terminate (no ops UI yet)

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ops.admin@ewp.demo","password":"Admin123!"}' | jq -r '.accessToken')

curl -sS -X PATCH "$API/contractors/{CONTRACTOR_ID}/workforce-transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetState":"SUSPENDED","reason":"Business relationship paused — demo."}' \
  | jq '{workforceState, isActive}'
```

---

## Access notification (EXTID feed)

No outbox UI. Integration API key required — [`EXTID_EVENT_FEED_INTEGRATION_RUNBOOK.md`](./security/EXTID_EVENT_FEED_INTEGRATION_RUNBOOK.md).

```bash
curl -sS "$API/extid/events?status=PENDING&limit=10" \
  -H "X-API-Key: $INTEGRATION_API_KEY" | jq '.items[] | {id, eventType, deliveryStatus}'
```

Audit: `CONTRACTOR_WORKFORCE_STATE_CHANGED`, `CONTRACTOR_WORKFORCE_DOMAIN_EVENT` at `/settings/audit-logs`.

---

## Workforce Import (Oracle HCM)

**Not** the supplier nomination path. Use **`workforce.import@ewp.demo`** / `GovOps123!`.

| Screen | Route |
|--------|--------|
| Contractor bootstrap | `/contractor-sources/oracle-hcm/operations` |
| Supplier sync | `/supplier-sources/oracle/operations` |

`ops.admin@ewp.demo` must be linked to Demo Organization (re-seed: `docker compose exec backend npm run db:seed`).

Connector demo: [`CONNECTOR_DEMO_UAT.md`](./CONNECTOR_DEMO_UAT.md)

---

## Automated smoke

```bash
./scripts/validate-workforce-uat.sh
```

Proves supplier nominate → ops review → activate at API level.

---

## Route map

| Route | Console |
|-------|---------|
| `/dashboard` | Both (different content) |
| `/suppliers`, `/suppliers/approvals` | Operations only |
| `/supplier-portal/*` | Supplier only |
| `/contractors/workforce-review` | Operations only |
| `/contractor-sources/oracle-hcm/operations` | Operations (connector role) |
| `/settings/audit-logs` | Operations |

---

## Known gaps

| Gap | Workaround |
|-----|------------|
| No post-activation suspend UI | API above |
| No EXTID UI | Audit + API |
| Empty supplier invoices | Expected in seed — shows empty state, not error |
