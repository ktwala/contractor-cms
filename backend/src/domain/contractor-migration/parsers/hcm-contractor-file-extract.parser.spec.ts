import { HcmContractorFileExtractParser } from './hcm-contractor-file-extract.parser';

describe('HcmContractorFileExtractParser', () => {
  const parser = new HcmContractorFileExtractParser();

  it('parses JSON array extract', () => {
    const records = parser.parseJson(
      JSON.stringify([
        {
          person_id: 'hcm-1',
          person_number: 'PN-1',
          email: 'one@example.com',
          worker_type: 'Contingent Worker',
        },
      ]),
    );
    expect(records).toHaveLength(1);
    expect(records[0].sourcePersonId).toBe('hcm-1');
    expect(records[0].sourcePersonNumber).toBe('PN-1');
  });

  it('parses CSV extract with header', () => {
    const csv = `person_id,person_number,email,worker_type
hcm-2,PN-2,two@example.com,Contingent Worker`;
    const records = parser.parseCsv(csv);
    expect(records[0].sourcePersonId).toBe('hcm-2');
    expect(records[0].sourcePayload.email).toBe('two@example.com');
  });
});
