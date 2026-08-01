import { Test } from '@nestjs/testing';
import { AccessIntegrationPublishService } from './access-integration-publish.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { IgaOutboxService } from '../../core/iga/iga-outbox.service';
import { CONTRACTOR_MIGRATED_EVENT_TYPE } from './types/acquisition-migrated-intent.types';

describe('AccessIntegrationPublishService (CAP-ACCESS-INTEGRATION §6)', () => {
  let service: AccessIntegrationPublishService;
  let persistCreated: jest.Mock;
  let outboxSave: jest.Mock;

  beforeEach(async () => {
    persistCreated = jest.fn().mockResolvedValue(undefined);
    outboxSave = jest.fn().mockResolvedValue({ id: 'outbox-1' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessIntegrationPublishService,
        {
          provide: IgaWorkforceEventWriter,
          useValue: {
            persistExternalPersonCreated: persistCreated,
            persistExternalPersonUpdated: jest.fn(),
            persistSponsorAssigned: jest.fn(),
          },
        },
        {
          provide: IgaOutboxService,
          useValue: { save: outboxSave },
        },
      ],
    }).compile();

    service = moduleRef.get(AccessIntegrationPublishService);
  });

  it('delegates external person created to workforce event writer', async () => {
    const contractor = { id: 'c-1', email: 'a@b.com' } as never;
    await service.publishExternalPersonCreated(contractor, 'org-1', {} as never);

    expect(persistCreated).toHaveBeenCalledWith(contractor, 'org-1', {});
  });

  it('queues acquisition migrated intent to IGA outbox', async () => {
    await service.publishAcquisitionMigratedIntent({
      organizationId: 'org-1',
      cmsContractorId: 'c-1',
      contractorBusinessId: 'CTR-1',
      legacyHcmPersonId: 'hcm-1',
      legacyHcmPersonNumber: 'PN-1',
      responsibleManagerEmployeeId: 'sp-1',
      engagementId: 'eng-1',
      migrationBatchId: 'batch-1',
    });

    expect(outboxSave).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CONTRACTOR_MIGRATED_EVENT_TYPE,
        cmsContractorId: 'c-1',
      }),
      expect.objectContaining({ organizationId: 'org-1' }),
    );
  });
});
