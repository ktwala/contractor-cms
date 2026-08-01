import { BadRequestException } from '@nestjs/common';
import {
  ContractorAccessIntent,
  ContractorPersonType,
  GovernanceRiskTier,
  IgaIntegrationPlaneStatus,
  ResponsibleManagerAccountabilityStatus,
  WorkerArchetypeKind,
} from '@prisma/client';
import { IgaEventBuilder } from './iga-event.builder';
import {
  IGA_EVENT_CONTRACT_VERSION,
  IGA_EVENT_SOURCE,
  IgaEventType,
} from './iga-event.types';

describe('IgaEventBuilder', () => {
  const contractorBase = {
    id: 'contractor-1',
    supplierId: 'supplier-1',
    externalPersonId: 'ext-person-1',
    personType: ContractorPersonType.PERSON_SUPPLIED_WORKER,
    workerArchetype: WorkerArchetypeKind.ARCHETYPE_SUPPLIED,
    accessIntent: ContractorAccessIntent.ACCESS_LOGICAL,
    riskTier: GovernanceRiskTier.RISK_LOW,
    igaIntegrationStatus: IgaIntegrationPlaneStatus.IGA_UNKNOWN,
  };

  beforeEach(() => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('buildExternalPersonCreated sets eventType, version, source, and required fields', () => {
    const builder = new IgaEventBuilder();
    const ev = builder.buildExternalPersonCreated({ contractor: contractorBase });
    expect(ev.version).toBe(IGA_EVENT_CONTRACT_VERSION);
    expect(ev.source).toBe(IGA_EVENT_SOURCE);
    expect(ev.eventType).toBe(IgaEventType.EXTERNAL_PERSON_CREATED);
    expect(ev.eventId).toBe('00000000-0000-4000-8000-000000000001');
    expect(ev.occurredAt).toBe('2026-05-15T12:00:00.000Z');
    expect(ev.contractorId).toBe('contractor-1');
    expect(ev.supplierId).toBe('supplier-1');
    expect(ev.externalPersonId).toBe('ext-person-1');
    expect(ev.igaIntegrationStatus).toBe('IGA_UNKNOWN');
    expect(ev.engagementId).toBeNull();
    expect(ev.responsibleManagerEmployeeId).toBeNull();
    expect(ev.responsibleManagerStatus).toBeNull();
  });

  it('allows null externalPersonId and null sponsor when engagement omitted', () => {
    const builder = new IgaEventBuilder();
    const ev = builder.buildExternalPersonUpdated({
      contractor: { ...contractorBase, externalPersonId: null },
    });
    expect(ev.externalPersonId).toBeNull();
    expect(ev.responsibleManagerEmployeeId).toBeNull();
    expect(ev.eventType).toBe(IgaEventType.EXTERNAL_PERSON_UPDATED);
  });

  it('embeds engagement sponsor fields when engagement provided', () => {
    const builder = new IgaEventBuilder();
    const ev = builder.buildExternalPersonCreated({
      contractor: contractorBase,
      engagement: {
        id: 'eng-1',
        responsibleManagerEmployeeId: 'sponsor-emp-1',
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });
    expect(ev.engagementId).toBe('eng-1');
    expect(ev.responsibleManagerEmployeeId).toBe('sponsor-emp-1');
    expect(ev.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ASSIGNED');
  });

  it('buildSponsorAssigned throws when responsibleManagerEmployeeId is missing', () => {
    const builder = new IgaEventBuilder();
    expect(() =>
      builder.buildSponsorAssigned({
        contractor: contractorBase,
        engagement: {
          id: 'eng-1',
          responsibleManagerEmployeeId: null,
          responsibleManagerStatus: null,
        },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      builder.buildSponsorAssigned({
        contractor: contractorBase,
        engagement: {
          id: 'eng-1',
          responsibleManagerEmployeeId: '   ',
          responsibleManagerStatus: null,
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('buildSponsorAssigned requires sponsor and sets EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED', () => {
    const builder = new IgaEventBuilder();
    const ev = builder.buildSponsorAssigned({
      contractor: contractorBase,
      engagement: {
        id: 'eng-1',
        responsibleManagerEmployeeId: '  hcm:1  ',
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });
    expect(ev.eventType).toBe(IgaEventType.EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED);
    expect(ev.responsibleManagerEmployeeId).toBe('hcm:1');
    expect(ev.engagementId).toBe('eng-1');
  });

  it('serializes to JSON without dropping keys', () => {
    const builder = new IgaEventBuilder();
    const ev = builder.buildExternalPersonCreated({ contractor: contractorBase });
    const json = JSON.parse(JSON.stringify(ev)) as Record<string, unknown>;
    expect(json.version).toBe(1);
    expect(json.source).toBe('contractor-cms');
    expect(json.eventType).toBe('EXTERNAL_PERSON_CREATED');
    expect(json.contractorId).toBe('contractor-1');
  });
});
