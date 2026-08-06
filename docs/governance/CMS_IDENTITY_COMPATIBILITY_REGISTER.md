# CMS Identity Compatibility Register

This register documents the comprehensive repository-wide audit of all remaining `cms` / `CMS` references in the codebase. It details why these **564** occurrences are intentionally protected under canonical engineering contracts, legacy wire formats, or architectural history records, preventing developers from removing compatibility contracts blindly or reintroducing CMS as the active product identity.

---

## 1. Classification Summary

| Category | Key Items | Exact Count | Status | Rationale |
| :--- | :--- | :---: | :---: | :--- |
| **Protected Role/Privilege Codes** | `CMS_ADMIN`, `CMS_ADMIN_ASSIGNED` | 141 | **RETAINED** | Embedded database role constraints, E2E checks, and authorization tokens. |
| **Protected Database Schema Enums** | `CMS_ONLY`, `CMS_NATIVE` | 114 | **RETAINED** | Database column structures, relational mapping schemas, and authority configuration enums. |
| **Historical PR / ADR Identifiers** | `PR-CMS-*` (including `PR-CTR-CMS-*`) | 285 | **RETAINED** | Retrospective project traceability, audit history, and ADR-012 renaming context. |
| **Integration Wire Compatibility** | `source: 'contractor-cms'` | 20 | **RETAINED** | Serialization format required for backward compatibility with external event-bus subscribers. |
| **Legacy Configuration / ADR Notes** | `LEGACY_DEMO_EMAIL_DOMAIN`, historical product names | 4 | **RETAINED** | Used to clean up/deactivate old demo accounts and explain the rename in ADR-012. |
| **TOTAL** | | **564** | | |

---

## 2. Category Detail & Verification

### A. Protected Role & Privilege Codes (`CMS_ADMIN`)
- **Occurrences**: 141
- **Files Affected**:
  - [seed.ts](file:///Users/ktwala/external-workforce-platform/backend/prisma/seed.ts)
  - [users.service.ts](file:///Users/ktwala/external-workforce-platform/backend/src/domain/users/users.service.ts)
  - [permissions.guard.ts](file:///Users/ktwala/external-workforce-platform/backend/src/core/auth/guards/permissions.guard.ts)
  - E2E Test files (e.g. `rbac.e2e-spec.ts`, `rbac-matrix.e2e-spec.ts`)
- **Audit Conclusion**: `CMS_ADMIN` is the system-wide super-administrator role code. Renaming this would require database migration scripts, frontend UI routing changes, and synchronization with third-party IdPs. It has been retained as a protected token, but its descriptive label in the UI and seed metadata has been modernized to "Platform Administrator".

### B. Database Schema Enums & Values (`CMS_ONLY`, `CMS_NATIVE`)
- **Occurrences**: 114
- **Files Affected**:
  - [schema.prisma](file:///Users/ktwala/external-workforce-platform/backend/prisma/schema.prisma)
  - Prisma Migration scripts under `backend/prisma/migrations/`
  - [suppliers.service.ts](file:///Users/ktwala/external-workforce-platform/backend/src/domain/suppliers/suppliers.service.ts)
  - [contractors.service.ts](file:///Users/ktwala/external-workforce-platform/backend/src/domain/contractors/contractors.service.ts)
- **Audit Conclusion**: Enums like `SupplierAuthorityMode.CMS_ONLY` and `MigrationSourceSystem.CMS_NATIVE` represent configuration modes stored in the SQL schemas. They are protected implementation constants.

### C. Legacy Wire Values (`contractor-cms`)
- **Occurrences**: 20
- **Files Affected**:
  - [iga-event.types.ts](file:///Users/ktwala/external-workforce-platform/backend/src/core/iga/iga-event.types.ts)
  - [extid-event-feed.e2e-spec.ts](file:///Users/ktwala/external-workforce-platform/backend/test/extid-event-feed.e2e-spec.ts)
  - [EXTID_EVENT_FEED_INTEGRATION_RUNBOOK.md](file:///Users/ktwala/external-workforce-platform/docs/security/EXTID_EVENT_FEED_INTEGRATION_RUNBOOK.md)
- **Audit Conclusion**: Outbox events emit `"source": "contractor-cms"` as a wire format. This is required for backward-compatibility with downstream event consumers (e.g. IAM/IGA systems).

### D. Historical PR and ADR Traceability
- **Occurrences**: 285
- **Files Affected**:
  - [ADR-012-External-Workforce-Platform-Naming.md](file:///Users/ktwala/external-workforce-platform/docs/business/ADR-012-External-Workforce-Platform-Naming.md)
  - Pull Request document references (`PR-CMS-CONNECTOR-1A-C`, `PR-CMS-OPERATIONS-1D0`, etc.)
- **Audit Conclusion**: These documents preserve architectural history and design-phase context. They are explicitly protected from cosmetic renaming.
