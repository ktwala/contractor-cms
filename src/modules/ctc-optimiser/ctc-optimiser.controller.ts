import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { P } from '../../common/constants/permissions';
import { CtcOptimiserService } from './ctc-optimiser.service';
import { CtcSolverService } from './services/ctc-solver.service';
import { RunCtcOptimiserDto } from './dto/run-ctc-optimiser.dto';
import { RunSimpleCtcOptimiserDto } from './dto/run-simple-ctc-optimiser.dto';
import { ApplyCtcScenarioDto } from './dto/apply-ctc-scenario.dto';

@ApiTags('CTC Optimiser')
@ApiBearerAuth('bearerAuth')
@Controller('ctc-optimiser')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class CtcOptimiserController {
  constructor(
    private readonly ctcOptimiserService: CtcOptimiserService,
    private readonly ctcSolverService: CtcSolverService,
  ) {}

  @Post('run')
  @Permissions(P.CTC_OPTIMISER_RUN)
  @ApiOperation({ summary: 'Run CTC optimisation' })
  @ApiResponse({ status: 201, description: 'Optimisation run completed' })
  async run(
    @Body() dto: RunCtcOptimiserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ctcOptimiserService.runOptimisation(
      dto,
      user.sub,
      (user as any).tenantId ?? 'default',
    );
  }

  @Post('run-simple')
  @Permissions(P.CTC_OPTIMISER_RUN)
  @ApiOperation({ summary: 'Run simplified CTC optimisation (advisory mode)' })
  @ApiResponse({ status: 201, description: 'Optimisation completed with advisory recommendations' })
  async runSimple(
    @Body() dto: RunSimpleCtcOptimiserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ctcSolverService.solve(
      dto,
      user.sub,
      (user as any).tenantId ?? 'default',
    );
  }

  @Get('run/:id')
  @Permissions(P.CTC_OPTIMISER_VIEW)
  @ApiOperation({ summary: 'Get CTC optimisation run by ID' })
  @ApiParam({ name: 'id', description: 'Optimiser run ID' })
  @ApiResponse({ status: 200, description: 'Optimiser run details' })
  async getRun(@Param('id') id: string) {
    return this.ctcOptimiserService.getRun(id);
  }

  @Post('apply')
  @Permissions(P.CTC_OPTIMISER_APPLY)
  @ApiOperation({ summary: 'Apply a selected CTC optimiser scenario' })
  @ApiResponse({ status: 200, description: 'Scenario applied' })
  async apply(
    @Body() dto: ApplyCtcScenarioDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ctcOptimiserService.applyScenario(
      dto,
      user.sub,
      (user as any).tenantId ?? 'default',
    );
  }
}
