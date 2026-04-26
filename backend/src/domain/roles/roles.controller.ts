import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions(PERMISSIONS.ROLES.CREATE)
  create(@Body() createRoleDto: CreateRoleDto, @Request() req) {
    return this.rolesService.create(createRoleDto, req.user.id);
  }

  @Get()
  @Permissions(PERMISSIONS.ROLES.READ)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES.READ)
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLES.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req,
  ) {
    return this.rolesService.update(id, updateRoleDto, req.user.id);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLES.DELETE)
  remove(@Param('id') id: string, @Request() req) {
    return this.rolesService.remove(id, req.user.id);
  }
}
