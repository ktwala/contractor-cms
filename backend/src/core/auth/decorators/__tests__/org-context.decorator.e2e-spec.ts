import { Reflector } from '@nestjs/core';
import { ORG_CONTEXT_KEY, OrgContextOptions } from '../org-context.decorator';

// Import all scoped controllers that should use currentUser extraction
import { TimesheetsController } from '../../../../domain/timesheets/timesheets.controller';
import { InvoicesController } from '../../../../domain/invoices/invoices.controller';
import { SuppliersController } from '../../../../domain/suppliers/suppliers.controller';
import { ContractorsController } from '../../../../domain/contractors/contractors.controller';
import { ProjectsController } from '../../../../domain/projects/projects.controller';
import { ContractsController } from '../../../../domain/contracts/contracts.controller';

describe('Org Context Decorators Contract', () => {
  const reflector = new Reflector();

  const getMethodOrgContext = (ControllerClass: any, methodName: string): OrgContextOptions | undefined => {
    return reflector.get<OrgContextOptions>(
      ORG_CONTEXT_KEY,
      ControllerClass.prototype[methodName],
    );
  };

  const expectValidContextExtraction = (ControllerClass: any, methodName: string) => {
    const context = getMethodOrgContext(ControllerClass, methodName);
    if (context) {
      // It should NEVER try to extract organizationId from query string
      const isMaliciousQueryExtraction = context.type === 'query' && context.key === 'organizationId';
      expect(isMaliciousQueryExtraction).toBe(false);

      // It SHOULD use currentUser extraction instead
      if (!['param', 'body'].includes(context.type)) {
        expect(context.type).toBe('currentUser');
      }
    }
  };

  it('TimesheetsController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(TimesheetsController, 'findAll');
  });

  it('InvoicesController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(InvoicesController, 'findAll');
  });

  it('SuppliersController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(SuppliersController, 'findAll');
  });

  it('ContractorsController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(ContractorsController, 'findAll');
  });

  it('ProjectsController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(ProjectsController, 'findAll');
  });

  it('ContractsController GET endpoints do not use query-based extraction', () => {
    expectValidContextExtraction(ContractsController, 'findAll');
  });
});
