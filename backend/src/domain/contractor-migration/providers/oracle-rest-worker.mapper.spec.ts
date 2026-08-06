import { mapOracleWorkerToExtractRecord } from './oracle-rest-worker.mapper';

describe('mapOracleWorkerToExtractRecord', () => {
  it('maps PersonId-style Oracle payload', () => {
    const record = mapOracleWorkerToExtractRecord(
      {
        PersonId: 99,
        PersonNumber: 'PN-99',
        FirstName: 'A',
        LastName: 'B',
        sponsor_employee_id: 'ewp:emp:1',
      },
      1,
    );

    expect(record.sourcePersonId).toBe('99');
    expect(record.sourcePersonNumber).toBe('PN-99');
    expect(record.sourcePayload.person_id).toBe('99');
  });
});
