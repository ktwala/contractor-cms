import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { CtcOptimiserController } from './ctc-optimiser.controller';
import { CtcOptimiserService } from './ctc-optimiser.service';
import { CtcSolverService } from './services/ctc-solver.service';
import { CtcScenarioGeneratorService } from './services/ctc-scenario-generator.service';
import { CtcConstraintService } from './services/ctc-constraint.service';
import { CtcScenarioEvaluatorService } from './services/ctc-scenario-evaluator.service';
import { CtcScenarioRankerService } from './services/ctc-scenario-ranker.service';
import { CtcExplanationService } from './services/ctc-explanation.service';
import { CtcVariableSpaceBuilder } from './services/ctc-variable-space.builder';
import { CtcResponseMapper } from './services/ctc-response.mapper';

@Module({
  imports: [AuditModule],
  controllers: [CtcOptimiserController],
  providers: [
    CtcOptimiserService,
    CtcSolverService,
    CtcScenarioGeneratorService,
    CtcConstraintService,
    CtcScenarioEvaluatorService,
    CtcScenarioRankerService,
    CtcExplanationService,
    CtcVariableSpaceBuilder,
    CtcResponseMapper,
  ],
  exports: [CtcOptimiserService, CtcSolverService],
})
export class CtcOptimiserModule {}
