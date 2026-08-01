import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoanTypesService } from './services/loan-types.service';
import { LoanApplicationsService } from './services/loan-applications.service';
import { LoanRepaymentsService } from './services/loan-repayments.service';

@Module({
  controllers: [LoansController],
  providers: [LoanTypesService, LoanApplicationsService, LoanRepaymentsService],
  exports: [LoanTypesService, LoanApplicationsService, LoanRepaymentsService],
})
export class LoansModule {}
