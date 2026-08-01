import { Module } from '@nestjs/common';
import { BenefitsController } from './benefits.controller';
import { BenefitPlansService } from './services/benefit-plans.service';
import { BenefitEnrollmentsService } from './services/benefit-enrollments.service';
import { BenefitCalculationsService } from './services/benefit-calculations.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BenefitsController],
  providers: [
    BenefitPlansService,
    BenefitEnrollmentsService,
    BenefitCalculationsService,
  ],
  exports: [
    BenefitPlansService,
    BenefitEnrollmentsService,
    BenefitCalculationsService,
  ],
})
export class BenefitsModule { }

