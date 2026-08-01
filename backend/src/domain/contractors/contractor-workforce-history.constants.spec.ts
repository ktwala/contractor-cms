import { ContractorWorkforceState } from '@prisma/client';
import {
  buildHcmBootstrapHistoryMetadata,
  CONTRACTOR_WORKFORCE_HISTORY_SOURCES,
  deriveWorkforceTransitionLabel,
} from './contractor-workforce-history.constants';

describe('contractor-workforce-history.constants', () => {
  it('derives labels from transitions, not eventType', () => {
    expect(
      deriveWorkforceTransitionLabel(null, ContractorWorkforceState.NOMINATED),
    ).toBe('Nominated');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.PENDING_APPROVAL,
      ),
    ).toBe('Submitted for review');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.PENDING_APPROVAL,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe('Activated');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.SUSPENDED,
      ),
    ).toBe('Suspended');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.SUSPENDED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe('Reinstated');
  });

  it('defines source authority channels', () => {
    expect(CONTRACTOR_WORKFORCE_HISTORY_SOURCES.SUPPLIER_PORTAL).toBe('SUPPLIER_PORTAL');
    expect(CONTRACTOR_WORKFORCE_HISTORY_SOURCES.HCM_BOOTSTRAP).toBe('HCM_BOOTSTRAP');
    expect(CONTRACTOR_WORKFORCE_HISTORY_SOURCES.LEGACY_BRIDGE).toBe('LEGACY_BRIDGE');
  });

  it('builds HCM bootstrap metadata with staging and batch identifiers', () => {
    expect(
      buildHcmBootstrapHistoryMetadata({
        stagingId: 'staging-1',
        migrationBatchId: 'batch-1',
        contractorSourceSyncRunId: 'run-1',
        sourcePersonId: 'hcm-1',
        sourcePersonNumber: 'PN-1',
        engagementId: 'eng-1',
        legacySourceSystem: 'ORACLE_HCM',
      }),
    ).toEqual({
      stagingId: 'staging-1',
      migrationBatchId: 'batch-1',
      contractorSourceSyncRunId: 'run-1',
      sourcePersonId: 'hcm-1',
      sourcePersonNumber: 'PN-1',
      engagementId: 'eng-1',
      legacySourceSystem: 'ORACLE_HCM',
      hcmBootstrap: true,
    });
  });

  it('labels null to ACTIVE as Activated (HCM bootstrap path)', () => {
    expect(
      deriveWorkforceTransitionLabel(null, ContractorWorkforceState.ACTIVE),
    ).toBe('Activated');
  });
});
