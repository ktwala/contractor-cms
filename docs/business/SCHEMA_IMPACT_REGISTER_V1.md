# Schema Impact Register v1

**Status:** `DRAFT` — **Schema candidate** tracking only; **no** migration filenames or execution orders are committed here.

**Purpose:** High-level register of **likely** tables and fields aligning to [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) **§5** and operating model **§18–§25**. Use with [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) **STREAM A**. **Canonical field-level design** (types, nullable strategy, candidate table) for the first implementation wave: [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md).

---

## 1. Register (conceptual)

| Concept | Likely home (primary) | Maturity | Notes |
|---------|------------------------|----------|--------|
| `external_person_id` | `Contractor` or junction `ExternalPerson` | Schema candidate | Correlates CMS ↔ HCM ↔ IGA; UUID strategy TBD. |
| `person_type` / `contractor_type` | `Contractor` | Schema candidate | Supports independent path (**OD-05**). |
| `sponsor_employee_id` | `ContractorEngagement` or `Contractor` | Schema candidate | HCM-resolvable FK or opaque id + adapter. |
| `sponsor_status` | Same as sponsor anchor | Schema candidate | ACTIVE, TRANSFER_PENDING, etc. |
| `sponsor_delegate_employee_id` | Same | Schema candidate | Optional. |
| `access_intent` | `Contractor` or engagement | Schema candidate | Enum: NONE, LOGICAL, PHYSICAL, BOTH, PRIVILEGED, … |
| `iga_integration_status` | Placement / contractor extension | Schema candidate | Mirrors §7.2 plane. |
| `access_enablement_status` | Placement / contractor extension | Schema candidate | Mirrors §7.3 plane. |
| `invoice_visibility_tier` | `User` policy or `UserRole` extension | Schema candidate | Alternative: purely RBAC + API scope without column. |

---

## 2. Existing tables touched (read-only analysis)

| Table | Current linkage | Impact note |
|-------|-------------------|-------------|
| `Contractor` | `supplierId` required | Sponsor fields may live here **or** on engagement; avoid duplicate sponsor if engagement is sole placement record. |
| `ContractorEngagement` | `contractorId`, `contractId`, optional `projectId`, `costCenterId` | Natural anchor for **sponsor** if “sponsor per placement” is doctrine. |
| `User` | `contractorId` optional | Supplier portal would add `supplierId` (future). |
| `Invoice` | `supplierId`, `organizationId` | Unchanged principal; **visibility** is RBAC/API, not invoice table shape. |

---

## 3. Anti-patterns (do not without ADR revision)

- Nullable **`Contractor.supplierId`** for default archetype without **OD-05** + legal sign-off.
- Merging **IGA state** into **`Contractor.isActive`** as a single bit — forbidden per **§7** / **§19**.

---

## 4. Stream alignment

| Stream | This register section |
|--------|------------------------|
| A — Schema | §1–§2 |
| C — HCM | `sponsor_*`, `cost_center` validation |
| D — IGA | `iga_integration_status`, `access_enablement_status`, `external_person_id` |

---

## References

- [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md)
- [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md)
- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md)
- [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md)
- [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md)
- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)
- [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md)
- [`CURRENT_STATE_DISCOVERY.md`](./CURRENT_STATE_DISCOVERY.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.4 | **RATIFICATION_STATE_CONSISTENCY_CHECK** |
| 1.3 | **SCHEMA_DIFF_REVIEW** for **1A** |
| 1.2 | **V1_0_RATIFICATION_RECORD** + **EXTID_MIGRATION_SAFETY_CHECKLIST** |
| 1.1 | Link **PR-EXTID-SCHEMA-1_DESIGN** + **IMPLEMENTATION_DRIFT_GATES** |
| 1.0 | Initial schema impact register |
