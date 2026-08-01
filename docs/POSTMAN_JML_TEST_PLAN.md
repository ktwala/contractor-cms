# Postman Test Plan — JML/IGA HR (Track A/B/C)

This is the Postman-based equivalent of **scripts/jml-integration-test.sh**. Same flow: bootstrap (login, resolve LE/PG), baseline delta (T0), Track A (effective today), Track B (effective tomorrow), Track C (`as_of` query).

## Files

| File | Purpose |
|------|--------|
| **postman/JML-IGA-HCM-Test-Plan.postman_collection.json** | Collection: requests + test scripts. |
| **postman/IGA-HCM-Local.postman_environment.json** | Environment: `baseUrl`, credentials, and runtime vars (tokens, IDs, checkpoints). |

## Setup in Postman

1. **Import**
   - Open Postman → Import → upload **JML-IGA-HCM-Test-Plan.postman_collection.json** and **IGA-HCM-Local.postman_environment.json**.

2. **Environment**
   - Select environment **IGA-HCM-Local** (top-right).
   - Set **baseUrl** if needed (default `http://localhost:3000`). Admin/IGA credentials are pre-filled for seed data (`admin@demo.payroll` / `iga@demo.payroll`, password `admin123`).

3. **Run**
   - Server must be up; DB seeded (legal entity, pay group, admin + iga users).
   - Run the collection (Runner or “Run” on the collection). Order matters: Bootstrap → Baseline → Track A → Track B → Track C.

## Collection structure

| Folder | Contents |
|--------|----------|
| **0 — Bootstrap** | Init Run Vars (sets `runId`, `today`, `tomorrow`, `empNoA`, `empNoB`, `t0`), Admin Login, IGA Login, HR Employees (IGA 200), Resolve Legal Entity, Resolve Pay Group. |
| **1 — Baseline Delta** | T0: HR delta `changed_since={{t0}}` (expect empty or small). |
| **2 — Track A** | Create Employee A → Employment A (today) → A1 delta → By Employee No A → History A (1 row) → Second Employment A (Mover) → A2 delta → History A (2 rows) → Terminate A → A3 delta → Delta since A3 (empty). |
| **3 — Track B** | Create Employee B → Employment B (today, Analyst) → B1 delta → Future Employment B (tomorrow, Senior Analyst) → B2 delta (current_employment still Analyst) → History B (future row) → Patch termination_date B → B3 delta. |
| **4 — Track C** | HR delta with `as_of={{tomorrow}}` (current_employment = Senior Analyst for B). |

## Environment variables (runtime)

After a full run, the environment will have been updated with:

- **adminToken**, **igaToken**
- **legalEntityId**, **payGroupId**
- **today**, **tomorrow**, **runId**, **empNoA**, **empNoB**
- **employeeIdA**, **employeeIdB**
- **t0**, **a1**, **a2**, **a3**, **b1**, **b2**, **b3** (checkpoints from `response.as_of`)

Reruns use a new **runId** (and thus new **empNoA** / **empNoB**) so you avoid duplicate `employee_no` errors.

## Running with Newman (CLI)

Install Newman:

```bash
npm install -g newman
```

Run the collection with the environment and optional reporters:

```bash
cd /path/to/payroll-platform
newman run postman/JML-IGA-HCM-Test-Plan.postman_collection.json \
  -e postman/IGA-HCM-Local.postman_environment.json
```

Export results (e.g. JUnit + HTML) for evidence:

```bash
newman run postman/JML-IGA-HCM-Test-Plan.postman_collection.json \
  -e postman/IGA-HCM-Local.postman_environment.json \
  --reporters cli,junit,html \
  --reporter-junit-export artifacts/newman/junit.xml \
  --reporter-html-export artifacts/newman/report.html
```

Create the output dir if needed: `mkdir -p artifacts/newman`.

## Notes

- **Init Run Vars** does a GET (to trigger the pre-request script). The request may return 401; the important part is that run vars are set.
- Response shapes follow the backend: list endpoints use `items`; HR delta uses `items`, `as_of`, `next_cursor`; employment history uses `items` with `effective_from`, `effective_to`, `job_title`.
- For a different base URL (e.g. port 4000), set **baseUrl** in the environment to `http://localhost:4000` (no trailing slash).
