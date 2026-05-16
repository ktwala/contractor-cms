import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import { IntegrationActor } from './decorators/integration-actor.decorator';
import { FailExtidEventDto } from './dto/fail-extid-event.dto';
import { ListExtidEventsDto } from './dto/list-extid-events.dto';
import { ExtidEventsService } from './extid-events.service';
import type { IntegrationActorContext } from './extid-events.types';
import { IntegrationPermissionsGuard } from './guards/integration-permissions.guard';
import { JwtOrApiKeyGuard } from './guards/jwt-or-api-key.guard';

/**
 * PR-EXTID-EVENT-FEED-1 — secure pull API for external workforce events.
 * IGA/middleware pulls; CMS does not provision or execute IGA logic.
 */
@Controller('extid/events')
@Public()
@UseGuards(JwtOrApiKeyGuard, IntegrationPermissionsGuard)
export class ExtidEventsController {
  constructor(private readonly extidEventsService: ExtidEventsService) {}

  @Get()
  @Permissions(PERMISSIONS.EXTID_EVENTS.READ)
  list(
    @IntegrationActor() actor: IntegrationActorContext,
    @Query() query: ListExtidEventsDto,
    @Req() req: Request,
  ) {
    return this.extidEventsService.listEvents(
      actor.organizationScope,
      query,
      actor,
      this.requestMeta(req),
    );
  }

  @Get(':id')
  @Permissions(PERMISSIONS.EXTID_EVENTS.READ)
  getOne(
    @IntegrationActor() actor: IntegrationActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.extidEventsService.getEvent(
      actor.organizationScope,
      id,
      actor,
      this.requestMeta(req),
    );
  }

  @Post(':id/ack')
  @Permissions(PERMISSIONS.EXTID_EVENTS.ACK)
  ack(
    @IntegrationActor() actor: IntegrationActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.extidEventsService.acknowledgeEvent(
      actor.organizationScope,
      id,
      actor,
      this.requestMeta(req),
    );
  }

  @Post(':id/fail')
  @Permissions(PERMISSIONS.EXTID_EVENTS.FAIL)
  fail(
    @IntegrationActor() actor: IntegrationActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FailExtidEventDto,
    @Req() req: Request,
  ) {
    return this.extidEventsService.failEvent(
      actor.organizationScope,
      id,
      body.reason,
      actor,
      this.requestMeta(req),
    );
  }

  private requestMeta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
