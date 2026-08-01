import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpenseCategoriesService } from './services/expense-categories.service';
import { ExpenseClaimsService } from './services/expense-claims.service';

@Module({
  controllers: [ExpensesController],
  providers: [
    ExpenseCategoriesService,
    ExpenseClaimsService,
  ],
  exports: [
    ExpenseCategoriesService,
    ExpenseClaimsService,
  ],
})
export class ExpensesModule {}
