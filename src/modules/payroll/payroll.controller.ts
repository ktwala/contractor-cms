import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayrollService } from './payroll.service';
import { TemplateGenerationService } from './template-generation.service';
import { AnyPermissions, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Response } from 'express';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller({ path: 'payroll', version: '1' })
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly templateService: TemplateGenerationService,
  ) {}

  @Get('reference-data')
  @RequirePermissions('employee:read') // fallback permission just to ensure they have some payroll access
  async getReferenceData() {
    return this.payrollService.getReferenceData();
  }

  @Get('templates/supplemental.xlsx')
  @AnyPermissions('data_import:read', 'data_import:write', 'data_import:approve', 'employee:read')
  async getSupplementalTemplate(@Res() res: Response) {
    const buffer = await this.templateService.generateSupplementalTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=supplemental_import_template.xlsx');
    res.send(buffer);
  }

  @Get('templates/opening-balances.xlsx')
  @AnyPermissions('data_import:read', 'data_import:write', 'data_import:approve', 'employee:read')
  async getOpeningBalancesTemplate(@Res() res: Response) {
    const buffer = await this.templateService.generateOpeningBalancesTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=opening_balances_import_template.xlsx');
    res.send(buffer);
  }
}
