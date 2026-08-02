import * as fs from 'fs';
import * as path from 'path';

describe('prisma/seed.ts', () => {
  const seedPath = path.join(__dirname, '../../prisma/seed.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(seedPath, 'utf8');
  });

  it('creates demo supplier contract and contractor engagement', () => {
    expect(content).toMatch(/supplierContract\.create/);
    expect(content).toMatch(/contractorEngagement\.create/);
  });

  it('does not use misleading "contractor with engagements" summary line', () => {
    expect(content).not.toMatch(/1 contractor with engagements created/);
  });

  it('summary mentions demo contract and engagement', () => {
    expect(content).toMatch(/demo supplier contract/i);
    expect(content).toMatch(/contractor engagement/i);
  });

  it('seeds unsponsored contractors for sponsor scope contrast', () => {
    expect(content).toMatch(/seed-unsponsored-a@demo\.local/);
    expect(content).toMatch(/Unsponsored demo contractors/);
  });

  it('seeds governance operations persona and fixtures', () => {
    expect(content).toMatch(/DEMO_LOGIN_PERSONAS\.workforceImportAdmin/);
    expect(content).toMatch(/GOVERNANCE_OPERATIONS_ADMIN/);
    expect(content).toMatch(/seedGovernanceFixtures/);
  });
});
