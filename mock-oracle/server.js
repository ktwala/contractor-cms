/**
 * PR-DEMO-CONNECTOR-1 — Mock Oracle Procurement + HCM REST for live connector demos.
 *
 * Routes (Oracle-style paginated JSON):
 *   GET /mock-oracle/procurement/suppliers
 *   GET /mock-oracle/hcm/workers
 *
 * Also serves default connector paths when base URL is host-only:
 *   GET /fscmRestApi/resources/11.13.18.05/suppliers
 *   GET /hcmRestApi/resources/11.13.18.05/workers
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.MOCK_ORACLE_PORT || 8080);
const FIXTURES_ROOT = path.join(__dirname, '../backend/test/fixtures');

function readJson(relPath) {
  const full = path.join(FIXTURES_ROOT, relPath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function toProcurementRestBody(fixture) {
  const now = new Date().toISOString();
  const items = (fixture.suppliers || []).map((s) => ({
    SupplierId: s.externalSupplierId,
    SupplierNumber: s.supplierNumber,
    Supplier: s.name,
    CountryCode: s.countryCode || 'ZA',
    TaxRegistrationNumber: s.taxRegistrationNumber,
    LastUpdateDate: now,
    _fixture: s.metadata?.fixture ?? s.externalSupplierId,
  }));
  return { items, count: items.length, hasMore: false, limit: 200, offset: 0 };
}

function toHcmRestBody(workers) {
  const items = workers.map((w) => ({
    PersonId: w.person_id,
    person_id: w.person_id,
    PersonNumber: w.person_number,
    person_number: w.person_number,
    display_name: w.display_name,
    email: w.email,
    WorkerType: w.worker_type,
    worker_type: w.worker_type,
    AssignmentStatus: w.assignment_status,
    assignment_status: w.assignment_status,
    supplier: w.supplier,
    vendor_name: w.supplier,
    _fixture: w.fixture,
  }));
  return { items, count: items.length, hasMore: false, limit: 200, offset: 0 };
}

const procurementBody = () =>
  toProcurementRestBody(readJson('oracle-procurement/demo-mtn-suppliers.json'));
const hcmBody = () => toHcmRestBody(readJson('oracle-hcm/demo-mtn-workers.json'));

const ROUTES = [
  ['/mock-oracle/procurement/suppliers', procurementBody],
  ['/fscmRestApi/resources/11.13.18.05/suppliers', procurementBody],
  ['/mock-oracle/hcm/workers', hcmBody],
  ['/hcmRestApi/resources/11.13.18.05/workers', hcmBody],
];

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'mock-oracle' });
    return;
  }

  const pathname = (req.url || '').split('?')[0];
  const match = ROUTES.find(([route]) => pathname === route || pathname.endsWith(route));
  if (req.method === 'GET' && match) {
    try {
      sendJson(res, 200, match[1]());
    } catch (err) {
      sendJson(res, 500, {
        error: 'FIXTURE_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'NOT_FOUND', path: pathname });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Oracle listening on http://0.0.0.0:${PORT}`);
  console.log('  GET /mock-oracle/procurement/suppliers');
  console.log('  GET /mock-oracle/hcm/workers');
});
