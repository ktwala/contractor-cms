# Governance signal lifecycle management

> **Status:** PR-GOV-SIGNAL-LIFECYCLE-1 foundation shipped (contractor drifts)  
> **Prerequisite doctrine:** [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md) · [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md)

## Platform identity

This is a **governance signal management system** — not a connector monitor.

| Layer | Role |
|-------|------|
| **Ingestion** | Transient (bootstrap / controlled waves) |
| **Lineage** | Contextual (provenance, correlation) |
| **Operational trust** | Durable (CMS authority after materialize) |
| **Signal lifecycle** | Whether findings persist, decay, or archive |

The third layer prevents **governance entropy**: without it, migration artifacts, sync metadata, and stale anomalies become indistinguishable from active operational risk.

---

## Three concepts (do not collapse)

| Concept | Purpose |
|---------|---------|
| **Bootstrap lineage** | Migration / correlation provenance |
| **Operational governance** | Live operational trust enforcement |
| **Signal lifecycle** | Governs whether signals persist, decay, or archive |

```text
bootstrap governance should decay
operational governance should persist
```

Without temporal context, every migration-era anomaly looks equally important forever. With **`workforceMigrationCutoverAt`**:

```text
before cutover → bootstrap governance dominant
after cutover  → operational governance dominant
```

Evolution: **static governance findings** → **time-aware governance intelligence** (`expiresAt`, auto-archive, cutover suppression).

---

## Maturity jump

The platform evolves from **connector governance** (detect mismatches) to **governance signal lifecycle management** (classify, decay, prioritize, archive).

Default list/summary behavior:

```text
operationalOnly=true
```

shifts the operator question from *“show me every historical inconsistency”* to *“show me what operationally matters now”*.

---

## Signal category (v1 implemented)

| `signalCategory` | Meaning |
|------------------|---------|
| `BOOTSTRAP` | Migration / correlation / cutover lineage |
| `OPERATIONAL` | Live governance affecting operational trust |

Mapped per `ContractorSourceDriftType` in `governance-signal-lifecycle.constants.ts`.

---

## Organization temporal anchor

| Field | Model | Purpose |
|-------|--------|---------|
| `workforceMigrationCutoverAt` | `Organization` | When bootstrap-phase governance stops dominating dashboards |

Nullable during active migration; set when tenant declares operational stabilization.

---

## Drift record lifecycle fields (v1)

| Field | Purpose |
|-------|---------|
| `signalCategory` | `BOOTSTRAP` \| `OPERATIONAL` |
| `detectedPhase` | Phase at detection time — **immutable** (audit / RCA / executive reporting) |
| `expiresAt` | Bootstrap auto-decay deadline |
| `suppressAfterCutover` | Hide from default operational surfaces after cutover |
| `lineageOnly` | Informational-only (no PDP posture) |
| `operationalImpact` | `NONE` \| `LIMITED` \| `ACTIVE` |
| `governanceOwner` | `MIGRATION` \| `OPERATIONS` queue ownership |

### Behavior matrix (target)

| Behavior | Bootstrap | Operational |
|----------|-----------|-------------|
| Executive dashboard | Temporary | Permanent |
| PDP enforcement | Rare (`lineageOnly`) | Common |
| Auto-archive on expiry | Yes | No |
| Hidden by default post-cutover | Yes (`suppressAfterCutover`) | No |
| Severity decay (future) | Yes | No |

### Why `detectedPhase` is immutable

Preserves provenance when category or visibility rules change later. Operators and auditors can distinguish:

- migration-era noise
- post-cutover governance failures
- operational issues introduced after stabilization

### Signal meaning (not detection complexity)

| Drift type | Category | Notes |
|------------|----------|--------|
| `UNSPONSORED_CONTRACTOR` | OPERATIONAL | Flagship — sponsor accountability |
| `DUPLICATE_PERSON_ANCHOR` | BOOTSTRAP | Migration identity integrity |
| `PERSON_CORRELATION_CONFLICT` | BOOTSTRAP | Correlation review |
| `WORKER_SOURCE_DRIFT` | BOOTSTRAP | `lineageOnly` + `NONE` impact — not operational risk |
| `CHECKPOINT_GAP` | BOOTSTRAP | Connector health during migration |

`lineageOnly` prevents connector telemetry from masquerading as operational trust failure.

### v1 runtime rules

1. **Detection** — classifies every new/updated drift with lifecycle metadata; sets `detectedPhase` once.
2. **Expiry** — bootstrap `expiresAt` = detectedAt + 30 days (config constant).
3. **Post-detect archive** — open `BOOTSTRAP` rows past `expiresAt` → `ARCHIVED`.
4. **Operational views** — `operationalOnly=true` (default) excludes suppressed bootstrap after cutover.

---

## API

```http
GET /contractor-sources/oracle-hcm/drift?operationalOnly=true
GET /contractor-sources/oracle-hcm/drift/summary   # operational-only when past cutover
```

---

## Roadmap (next maturity layers)

| Capability | Strategic effect |
|------------|------------------|
| Severity decay | Reduces stale migration panic |
| SLA by category | Bootstrap vs operational accountability |
| Executive rollups excluding bootstrap | Cleaner governance reporting |
| Migration lineage toggle (`operationalOnly=false`) | Auditability without polluting operations |
| Category-specific escalation | Operational signals escalate harder |
| Drift aging models | Prioritization over time |
| Supplier drift parity | Same lifecycle on `SupplierSourceDrift` |
| Per-tenant bootstrap TTL / cutover policies | Tenant-specific migration windows |
| Auto-resolve bootstrap when correlation fixed | Less manual migration cleanup |

Admin API to set `workforceMigrationCutoverAt` is a prerequisite for production cutover ceremonies.

---

## Related

- [`business/PR-GOV-SIGNAL-LIFECYCLE-1.md`](business/PR-GOV-SIGNAL-LIFECYCLE-1.md) — PR slice
- [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md) — bootstrap vs authority
