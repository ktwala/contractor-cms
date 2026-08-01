import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { LoanTypesService } from './services/loan-types.service';
import { LoanApplicationsService } from './services/loan-applications.service';
import { LoanRepaymentsService } from './services/loan-repayments.service';

@Controller('api/loans')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LoansController {
  constructor(
    private readonly loanTypesService: LoanTypesService,
    private readonly applicationsService: LoanApplicationsService,
    private readonly repaymentsService: LoanRepaymentsService,
  ) {}

  // ==================== Loan Types ====================

  @Get('types')
  async getLoanTypes(
    @Query('country') country?: string,
    @Query('active_only') activeOnly?: string,
  ) {
    try {
      const types = await this.loanTypesService.findAll({
        country,
        active_only: activeOnly === 'true',
      });
      return types;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch loan types');
    }
  }

  @Get('types/:id')
  async getLoanType(@Param('id') id: string) {
    try {
      const type = await this.loanTypesService.findById(id);
      if (!type) {
        throw new Error('Loan type not found');
      }
      return type;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch loan type');
    }
  }

  @Get('types/available/:employeeId')
  async getAvailableLoanTypes(
    @Param('employeeId') employeeId: string,
    @Query('country') country: string,
  ) {
    try {
      const types = await this.loanTypesService.findAvailableForEmployee(employeeId, country);
      return types;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch available loan types');
    }
  }

  @Get('types/:id/max-amount/:employeeId')
  async getMaxLoanAmount(
    @Param('id') loanTypeId: string,
    @Param('employeeId') employeeId: string,
  ) {
    try {
      const maxAmount = await this.loanTypesService.calculateMaxAmount(loanTypeId, employeeId);
      return { max_amount: maxAmount };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to calculate maximum amount');
    }
  }

  @Post('types/calculate-repayment')
  calculateRepayment(@Body() body: any) {
    try {
      const { principal, interest_rate, tenure_months, interest_type } = body;

      if (!principal || !tenure_months || !interest_type) {
        throw new Error('Missing required fields');
      }

      const result = this.loanTypesService.calculateRepayment(
        parseFloat(principal),
        parseFloat(interest_rate || 0),
        parseInt(tenure_months),
        interest_type,
      );

      return result;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to calculate repayment');
    }
  }

  @Post('types')
  @RequirePermissions('loan.type.create')
  async createLoanType(@Body() body: any, @Request() req: any) {
    try {
      const type = await this.loanTypesService.create({
        ...body,
        created_by: req.user.id,
      });
      return type;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create loan type');
    }
  }

  @Put('types/:id')
  @RequirePermissions('loan.type.update')
  async updateLoanType(@Param('id') id: string, @Body() body: any) {
    try {
      const type = await this.loanTypesService.update(id, body);
      return type;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update loan type');
    }
  }

  @Post('types/:id/activate')
  @RequirePermissions('loan.type.update')
  async activateLoanType(@Param('id') id: string) {
    try {
      await this.loanTypesService.activate(id);
      return { message: 'Loan type activated successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to activate loan type');
    }
  }

  @Post('types/:id/deactivate')
  @RequirePermissions('loan.type.update')
  async deactivateLoanType(@Param('id') id: string) {
    try {
      await this.loanTypesService.deactivate(id);
      return { message: 'Loan type deactivated successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to deactivate loan type');
    }
  }

  @Delete('types/:id')
  @RequirePermissions('loan.type.delete')
  async deleteLoanType(@Param('id') id: string) {
    try {
      await this.loanTypesService.delete(id);
      return { message: 'Loan type deleted successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete loan type');
    }
  }

  // ==================== Loan Applications ====================

  @Get('applications')
  async getApplications(
    @Query('employee_id') employeeId?: string,
    @Query('status') status?: string,
    @Query('loan_type_id') loanTypeId?: string,
  ) {
    try {
      const applications = await this.applicationsService.findAll({
        employee_id: employeeId,
        status,
        loan_type_id: loanTypeId,
      });
      return applications;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch applications');
    }
  }

  @Get('applications/:id')
  async getApplication(@Param('id') id: string) {
    try {
      const application = await this.applicationsService.findById(id);
      if (!application) {
        throw new Error('Application not found');
      }
      return application;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch application');
    }
  }

  @Post('applications')
  async createApplication(@Body() body: any, @Request() req: any) {
    try {
      const application = await this.applicationsService.create(body);
      return application;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create application');
    }
  }

  @Post('applications/:id/submit')
  async submitApplication(@Param('id') id: string, @Request() req: any) {
    try {
      const application = await this.applicationsService.submit(id, req.user.id);
      return application;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit application');
    }
  }

  @Post('applications/:id/approve')
  @RequirePermissions('loan.application.approve')
  async approveApplication(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    try {
      const application = await this.applicationsService.approve(
        id,
        req.user.id,
        body.approved_amount,
        body.comments,
      );
      return application;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to approve application');
    }
  }

  @Post('applications/:id/reject')
  @RequirePermissions('loan.application.reject')
  async rejectApplication(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    try {
      if (!body.reason) {
        throw new Error('Rejection reason is required');
      }
      await this.applicationsService.reject(id, req.user.id, body.reason);
      return { message: 'Application rejected successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to reject application');
    }
  }

  @Post('applications/:id/cancel')
  async cancelApplication(@Param('id') id: string, @Request() req: any) {
    try {
      await this.applicationsService.cancel(id, req.user.id);
      return { message: 'Application cancelled successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to cancel application');
    }
  }

  @Get('stats/applications')
  async getApplicationStatistics(@Query('employee_id') employeeId?: string) {
    try {
      const stats = await this.applicationsService.getStatistics({
        employee_id: employeeId,
      });
      return stats;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch statistics');
    }
  }

  // ==================== Active Loans & Repayments ====================

  @Get('active')
  async getActiveLoans(
    @Query('employee_id') employeeId?: string,
    @Query('status') status?: string,
  ) {
    try {
      const loans = await this.repaymentsService.findAllLoans({
        employee_id: employeeId,
        status,
      });
      return loans;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch active loans');
    }
  }

  @Get('active/:id')
  async getActiveLoan(@Param('id') id: string) {
    try {
      const loan = await this.repaymentsService.findLoanById(id);
      if (!loan) {
        throw new Error('Loan not found');
      }
      return loan;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch loan');
    }
  }

  @Get('active/:id/schedule')
  async getLoanSchedule(@Param('id') id: string) {
    try {
      const schedule = await this.repaymentsService.getLoanSchedule(id);
      return schedule;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch loan schedule');
    }
  }

  @Get('active/:id/repayments')
  async getLoanRepayments(@Param('id') id: string) {
    try {
      const repayments = await this.repaymentsService.getLoanRepayments(id);
      return repayments;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch repayments');
    }
  }

  @Post('active/disburse')
  @RequirePermissions('loan.disburse')
  async disburseLoan(@Body() body: any, @Request() req: any) {
    try {
      const { application_id, disbursement_date, first_deduction_date } = body;

      if (!application_id || !disbursement_date || !first_deduction_date) {
        throw new Error('Missing required fields');
      }

      const loan = await this.repaymentsService.disburse(
        application_id,
        disbursement_date,
        first_deduction_date,
        req.user.id,
      );

      return loan;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to disburse loan');
    }
  }

  @Post('active/:id/repay')
  @RequirePermissions('loan.repayment.record')
  async recordRepayment(@Param('id') loanId: string, @Body() body: any, @Request() req: any) {
    try {
      const { amount, payment_date, payroll_run_id } = body;

      if (!amount || !payment_date) {
        throw new Error('Missing required fields');
      }

      const repayment = await this.repaymentsService.recordRepayment(
        loanId,
        parseFloat(amount),
        payment_date,
        payroll_run_id,
        req.user.id,
      );

      return repayment;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to record repayment');
    }
  }

  @Get('payroll/deductions')
  @RequirePermissions('payroll.view')
  async getPayrollDeductions(@Query('payroll_date') payrollDate: string) {
    try {
      if (!payrollDate) {
        throw new Error('Payroll date is required');
      }

      const deductions = await this.repaymentsService.getLoansForPayroll(payrollDate);
      return deductions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch payroll deductions');
    }
  }

  @Get('stats/loans')
  async getLoanStatistics(@Query('employee_id') employeeId?: string) {
    try {
      const stats = await this.repaymentsService.getStatistics({
        employee_id: employeeId,
      });
      return stats;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch statistics');
    }
  }
}
