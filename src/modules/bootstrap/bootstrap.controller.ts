import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { BootstrapService } from './bootstrap.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

@Controller('bootstrap')
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get('status')
  async getStatus(@Req() req: Request) {
    return this.bootstrapService.getStatus({
      ipAddress: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('admin')
  async createFirstAdmin(
    @Body() body: BootstrapAdminDto,
    @Req() req: Request,
  ) {
    const { first_name, last_name, email, password } = body;
    return this.bootstrapService.createFirstAdmin(
      {
        firstName: first_name?.trim() || 'System',
        lastName: last_name?.trim() || 'Admin',
        email,
        password,
      },
      {
        ipAddress: req.ip ?? req.socket?.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    );
  }
}
