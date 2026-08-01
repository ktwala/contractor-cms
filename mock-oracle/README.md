# Mock Oracle REST (demo / UAT)

Standalone HTTP service that serves deterministic connector fixtures as Oracle-style paginated JSON.

## Start

```bash
npm run mock:oracle
# or: node mock-oracle/server.js
```

Port: `8080` (`MOCK_ORACLE_PORT`).

## Endpoints

| Method | Path | Source fixture |
|--------|------|----------------|
| GET | `/mock-oracle/procurement/suppliers` | `backend/test/fixtures/oracle-procurement/demo-mtn-suppliers.json` |
| GET | `/mock-oracle/hcm/workers` | `backend/test/fixtures/oracle-hcm/demo-mtn-workers.json` |
| GET | `/health` | Liveness |

CMS backend env (see `backend/.env.example`):

```bash
ORACLE_PROCUREMENT_REST_BASE_URL=http://localhost:8088/mock-oracle/procurement
ORACLE_PROCUREMENT_REST_SUPPLIERS_PATH=/suppliers
HCM_ORACLE_REST_BASE_URL=http://localhost:8088/mock-oracle/hcm
HCM_ORACLE_REST_WORKERS_PATH=/workers
```
