import { SupplierStatus } from '@prisma/client';
import {
  HcmContractorCorrelationMatchStatus,
  HcmContractorCorrelationConfidence,
  HcmQuarantineReasonCode,
} from '@prisma/client';
import {
  summarizeWorkforceReadinessFromStaging,
  type StagingReadinessRow,
  type UntrustedSupplierRef,
} from '../workforce-readiness-telemetry.util';

const horizon: UntrustedSupplierRef = {
  id: 'sup-horizon',
  status: SupplierStatus.PENDING_APPROVAL,
  companyName: 'Horizon Staffing Solutions (Pty) Ltd',
  tradingName: 'Horizon Staffing',
};

const ubuntu: UntrustedSupplierRef = {
  id: 'sup-ubuntu',
  status: SupplierStatus.SUSPENDED,
  companyName: 'Ubuntu Field Services (Pty) Ltd',
  tradingName: 'Ubuntu Field Services',
};

function stagingRow(overrides: Partial<StagingReadinessRow> & Pick<StagingReadinessRow, 'id'>): StagingReadinessRow {
  return {
    normalizedPayloadJson: { supplier: 'Horizon Staffing' },
    correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
    correlationConfidence: null,
    proposedContractorId: null,
    proposedContractor: null,
    quarantineEntries: [],
    ...overrides,
  };
}

describe('workforce readiness telemetry', () => {
  it('counts unique workers separately from overlapping reasons', () => {
    const rows: StagingReadinessRow[] = [
      stagingRow({
        id: 'w1',
        normalizedPayloadJson: { supplier: 'Horizon Staffing' },
        correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
        correlationConfidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
      }),
      stagingRow({
        id: 'w2',
        normalizedPayloadJson: { supplier: 'Ubuntu Field Services' },
      }),
      stagingRow({
        id: 'w3',
        normalizedPayloadJson: { supplier: 'Atlas Consulting' },
        proposedContractor: {
          isActive: true,
          engagements: [{ responsibleManagerEmployeeId: null }],
        },
      }),
    ];

    const summary = summarizeWorkforceReadinessFromStaging(rows, [horizon, ubuntu], {
      workersBlockedPendingSupplierTrust: 1,
      workersBlockedSuspendedSupplier: 1,
    });

    expect(summary.workersAssessed).toBe(3);
    expect(summary.workersNotReadyUnique).toBe(3);
    expect(summary.readinessReasonsDetected).toBe(5);
    expect(summary.workersBlockedPendingSupplierTrust).toBe(1);
    expect(summary.workersBlockedSuspendedSupplier).toBe(1);
    expect(summary.duplicateWorkerCount).toBe(1);
    expect(summary.manualReviewRequired).toBe(1);
    expect(summary.missingResponsibleManagerCount).toBe(1);
  });

  it('flags missing supplier link from empty vendor or quarantine', () => {
    const summary = summarizeWorkforceReadinessFromStaging(
      [
        stagingRow({ id: 'w1', normalizedPayloadJson: { supplier: '' } }),
        stagingRow({
          id: 'w2',
          normalizedPayloadJson: { supplier: 'Atlas Consulting' },
          quarantineEntries: [{ reasonCode: HcmQuarantineReasonCode.SUPPLIER_UNRESOLVED }],
        }),
      ],
      [],
    );

    expect(summary.missingSupplierLinks).toBe(2);
    expect(summary.workersNotReadyUnique).toBe(2);
  });
});
