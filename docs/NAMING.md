# Hubsec Workforce Platform — Canonical Naming

Use these names consistently across documentation, marketing, and UI.

| Context | Name |
|---------|------|
| **Product** | Hubsec Workforce Platform |
| **Admin UI** | Hubsec Workforce Admin |
| **Employee UI** | Hubsec Workforce Employee Portal |

---

## Naming Hierarchy

```
Hubsec Workforce Platform
├── Hubsec Workforce Admin (administrative console)
└── Hubsec Workforce Employee Portal (self-service portal)
```

**UI header:** In-app branding can use "Hubsec Workforce" — the context (admin URL, employee URL) already implies which portal the user is in.

---

## URL Structure (when hosted)

| Portal | Suggested URL |
|--------|---------------|
| Platform root | `workforce.hubsec.io` |
| Admin | `admin.workforce.hubsec.io` |
| Employee Portal | `employee.workforce.hubsec.io` |

Local development: Admin (3001), Employee Portal (3000).

---

## Usage

- **Product**: Use "Hubsec Workforce Platform" for the platform as a whole (e.g. "Hubsec Workforce Platform provides payroll, HCM, and compliance for South Africa and Lesotho.")
- **Admin UI**: Use "Hubsec Workforce Admin" when referring to the admin/enterprise interface (port 3001).
- **Employee UI**: Use "Hubsec Workforce Employee Portal" when referring to the self-service employee interface (port 3000).

---

## Technical Note (Product vs Codebase)

The codebase and Docker containers use the project slug `hubsec-workforce-platform` for the repository, package name, and service identifiers. The technical prefix `workforce` is used for container names, networks, and metric namespaces.

The term `payroll` is retained in module names, database tables, and API routes where it accurately describes payroll-specific business logic (e.g. `src/modules/payroll/`, payrun lifecycle, payroll containers).

| Layer | Name |
|-------|------|
| Product | Hubsec Workforce Platform |
| Admin UI | Hubsec Workforce Admin |
| Employee UI | Hubsec Workforce Employee Portal |
| Repository | hubsec-workforce-platform |
| Technical prefix | workforce |
| Payroll module | payroll (domain-specific, retained) |

---

*Last updated: August 2026*
