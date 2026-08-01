# PR-WORKFORCE-BLACKLIST-1 — CMS workforce policy block

**Status:** COMPLETE  
**Builds on:** [`PR-WORKFORCE-REVIEW-OUTCOMES-1.md`](./PR-WORKFORCE-REVIEW-OUTCOMES-1.md)

## Guardrail

> Blacklisting is a **CMS workforce block**, not yet an MTN disciplinary approval workflow.

No un-blacklist, access revocation, do-not-rehire policy engine, SNOW, or Aveksa.

## Scope

Uses existing `BLACKLISTED` `workforceState`. Ops-only transition with:

| From | Allowed |
|------|---------|
| `NOMINATED` | → `BLACKLISTED` |
| `PENDING_APPROVAL` | → `BLACKLISTED` |
| `REJECTED` | → `BLACKLISTED` |
| `ACTIVE` | → `BLACKLISTED` |
| `TERMINATED` | → `BLACKLISTED` |

**Required on blacklist:**

- `reason` — workforce history + audit
- `authorityNote` — internal ops metadata (not portal-visible)

**Timeline:** derived label **Blacklisted**  
**Domain stub:** `ContractorBlacklisted` (existing)

## Portal visibility

- Supplier portal list still **excludes** `BLACKLISTED` contractors (policy block removes operational visibility)
- If timeline were visible: shows **Blacklisted** label only — **no reason, no authority note**

## Ops UX

| Surface | Action |
|---------|--------|
| Workforce review queue | **Blacklist** on nominated / pending rows |
| Rejected nominations panel | **Blacklist** |
| Policy block candidates | **Blacklist** on active / terminated rows |

Modal collects **Reason** + **Authority note (internal)**.

## API

```http
PATCH /contractors/:id/workforce-transition
{
  "targetState": "BLACKLISTED",
  "reason": "...",
  "authorityNote": "..."
}

GET /contractors/workforce-blacklist-eligible
```

## Out of scope

- Un-blacklist
- Access / IGA revocation integration
- Do-not-rehire policy engine
- MTN approval workflow

## Workforce plane paths (complete)

```text
Happy path:     Nominate → Review → Activate
Exception path: Reject / Send back / Reopen
Policy block:   → BLACKLISTED (from intake, review, rejected, active, terminated)
```

## Next

RDS mapping can proceed with happy, exception, and policy-block paths proven.
