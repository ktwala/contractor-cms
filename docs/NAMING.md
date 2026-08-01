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

The codebase and Docker containers use the project slug `payroll-platform` for directories, package names, and service names. This is intentional and need not change—the canonical *product* naming above applies to user-facing documentation and branding.

| Layer | Name |
|-------|------|
| Product | Hubsec Workforce Platform |
| Admin UI | Hubsec Workforce Admin |
| Employee UI | Hubsec Workforce Employee Portal |
| Codebase | payroll-platform |

Mature products separate product identity from technical identifiers (e.g. Workday → workday-core, Okta → okta-core).

---

*Last updated: March 2026*
