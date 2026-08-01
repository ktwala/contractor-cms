/**
 * Writes Oracle mock fixtures for the MTN demo story from demo-mtn-story.constants.ts
 *
 * Usage: npx ts-node scripts/generate-mtn-demo-fixtures.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  MTN_DEMO_SUPPLIERS,
  MTN_DEMO_WORKERS,
} from '../src/domain/demo/demo-mtn-story.constants';

const FIXTURES_ROOT = path.join(__dirname, '../test/fixtures');

function procurementFixture() {
  return {
    suppliers: MTN_DEMO_SUPPLIERS.map((s) => ({
      externalSupplierId: s.externalSupplierId,
      supplierNumber: s.supplierNumber,
      name: s.companyName,
      countryCode: 'ZA',
      taxRegistrationNumber: s.taxRegistrationNumber,
      metadata: {
        fixture: s.externalSupplierId,
        scenario: s.scenario,
        tradingName: s.tradingName,
        industry: s.industry,
        region: s.region,
        contactPerson: s.contactPerson,
        contactEmail: s.contactEmail,
        logoSlug: s.logoSlug,
        supplierType: s.supplierType,
        oracleStatus: 'Approved',
      },
    })),
  };
}

function hcmFixture() {
  return MTN_DEMO_WORKERS.map((w) => {
    const row: Record<string, unknown> = {
      person_id: w.personId,
      person_number: w.personNumber,
      display_name: w.displayName,
      email: w.email,
      worker_type: 'CWK',
      assignment_status: 'active',
      fixture: w.personId,
      scenario: w.scenario,
    };
    if (w.supplierTradingName) {
      row.supplier = w.supplierTradingName;
    }
    return row;
  });
}

function main() {
  const procurementPath = path.join(
    FIXTURES_ROOT,
    'oracle-procurement/demo-mtn-suppliers.json',
  );
  const hcmPath = path.join(FIXTURES_ROOT, 'oracle-hcm/demo-mtn-workers.json');

  fs.writeFileSync(procurementPath, `${JSON.stringify(procurementFixture(), null, 2)}\n`);
  fs.writeFileSync(hcmPath, `${JSON.stringify(hcmFixture(), null, 2)}\n`);

  console.log(`✓ Wrote ${MTN_DEMO_SUPPLIERS.length} suppliers → ${procurementPath}`);
  console.log(`✓ Wrote ${MTN_DEMO_WORKERS.length} workers → ${hcmPath}`);
}

main();
