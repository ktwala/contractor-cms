import { SourceIntegrationService } from '../../integration/source-integration.service';
import { DemoSupplierSetupService } from '../demo/demo-supplier-setup.service';
import { DemoMtnStorySetupService } from '../demo/demo-mtn-story-setup.service';
import { OracleSupplierImportController } from './oracle-supplier-import.controller';

describe('OracleSupplierImportController (PR-CMS-INT-3)', () => {
  const sourceIntegration = {
    importSuppliers: jest.fn(),
    listSupplierStaging: jest.fn(),
    promoteSupplierStagingRow: jest.fn(),
    promoteSupplierStagingBatch: jest.fn(),
  };

  const demoSupplierSetup = {
    completeSupplierSetup: jest.fn(),
  };

  const demoMtnStorySetup = {
    completeMtnStory: jest.fn(),
  };

  const accessContext = {
    targetOrganizationId: 'org-1',
    actorUserId: 'user-1',
  } as never;

  let controller: OracleSupplierImportController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OracleSupplierImportController(
      sourceIntegration as unknown as SourceIntegrationService,
      demoSupplierSetup as unknown as DemoSupplierSetupService,
      demoMtnStorySetup as unknown as DemoMtnStorySetupService,
    );
  });

  it('routes import through SourceIntegrationService with normalized records', async () => {
    sourceIntegration.importSuppliers.mockResolvedValue({ imported: 1 });
    const dto = {
      suppliers: [
        {
          externalSupplierId: 'ORA-1',
          name: 'Acme',
          countryCode: 'ZA',
        },
      ],
    };

    await controller.importSuppliers(accessContext, dto);

    expect(sourceIntegration.importSuppliers).toHaveBeenCalledWith(
      accessContext,
      {
        records: [
          {
            externalSupplierId: 'ORA-1',
            supplierNumber: null,
            name: 'Acme',
            countryCode: 'ZA',
            taxRegistrationNumber: null,
            metadata: undefined,
          },
        ],
      },
    );
  });

  it('routes promote through SourceIntegrationService, not Oracle import service', async () => {
    sourceIntegration.promoteSupplierStagingRow.mockResolvedValue({
      stagingId: 'stg-1',
      outcome: 'CREATED',
    });

    await controller.promoteStagingRow(accessContext, 'stg-1');

    expect(sourceIntegration.promoteSupplierStagingRow).toHaveBeenCalledWith(
      accessContext,
      'stg-1',
    );
  });

  it('does not inject Oracle-specific domain services', () => {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      OracleSupplierImportController,
    ) as unknown[] | undefined;
    const names = (paramTypes ?? []).map((t) =>
      typeof t === 'function' ? t.name : String(t),
    );
    expect(names).toEqual([
      'SourceIntegrationService',
      'DemoSupplierSetupService',
      'DemoMtnStorySetupService',
    ]);
  });
});
