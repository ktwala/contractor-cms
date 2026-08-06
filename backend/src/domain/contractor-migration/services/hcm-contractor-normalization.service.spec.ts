import { HcmContractorNormalizationService } from './hcm-contractor-normalization.service';

describe('HcmContractorNormalizationService', () => {
  const service = new HcmContractorNormalizationService();

  it('maps Oracle-style payload fields to canonical shape', () => {
    const normalized = service.normalize(
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'Ada.Lovelace@example.com',
        worker_type: 'Contingent Worker',
        start_date: '2024-01-15',
        end_date: '2025-12-31',
        sponsor_employee_id: 'ewp:emp:responsible-manager-1',
        assignment_status: 'Active',
        vendor_name: 'Acme Vendor',
      },
      { sourcePersonId: 'hcm-1001', sourcePersonNumber: 'PN-1001' },
    );

    expect(normalized.sourcePersonId).toBe('hcm-1001');
    expect(normalized.sourcePersonNumber).toBe('PN-1001');
    expect(normalized.email).toBe('ada.lovelace@example.com');
    expect(normalized.workerType).toBe('Contingent Worker');
    expect(normalized.startDate).toBe('2024-01-15');
    expect(normalized.responsibleManagerEmployeeId).toBe('ewp:emp:responsible-manager-1');
    expect(normalized.displayName).toBe('Ada Lovelace');
  });
});
