# RBAC v1.0 — Release Procedure

## Definition of Done

RBAC v1.0 includes:
- Canonical roles & permissions (seeded)
- Permission enforcement (AND / OR semantics)
- Legal-entity scoping enforced in services
- Separation of Duties (PR-SOD-01/02/03, SARS-SOD-01/02)
- Governance documented (`RBAC_SPEC.md`, `RBAC_GOVERNANCE.md`)
- Audit logging for SoD violations, privilege-use, and PLATFORM_SUPERADMIN

---

## Git Tag Procedure

### 1. Ensure branch is clean

```bash
git status
```

✔ No uncommitted changes  
✔ `seed.ts`, `RBAC_SPEC.md`, `RBAC_GOVERNANCE.md`, `CHANGELOG.md` committed

### 2. Create annotated tag

```bash
git tag -a rbac-v1.0 -m "RBAC v1.0: roles, permissions, legal-entity scoping, SoD enforcement"
```

### 3. Push tag

```bash
git push origin rbac-v1.0
```

---

## Step 2.5 Sign-Off

> Step 2.5 completed. All SoD violations and high-impact privilege usage are logged using a canonical audit schema. PLATFORM_SUPERADMIN usage is fully auditable.
