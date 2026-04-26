import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(PERMISSIONS.USERS.CREATE)
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create(createUserDto, req.user.id);
  }

  @Get()
  @Permissions(PERMISSIONS.USERS.READ)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USERS.READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USERS.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    // Note: DEACTIVATE permission might be checked separately if we get more granular,
    // but the task requested USERS.UPDATE for general profile changes.
    // If the user tries to deactivate (isActive === false), we can optionally enforce USERS.DEACTIVATE here.
    return this.usersService.update(id, updateUserDto, req.user.id);
  }

  @Get(':id/roles')
  @Permissions(PERMISSIONS.ROLES.READ)
  async getUserRoles(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return user.roles;
  }

  @Put(':id/roles')
  @Permissions(PERMISSIONS.ROLES.ASSIGN)
  assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
    @Request() req,
  ) {
    return this.usersService.assignRoles(id, assignRolesDto, req.user.id);
  }

  @Post(':id/roles')
  @Permissions(PERMISSIONS.ROLES.ASSIGN)
  addRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
    @Request() req,
  ) {
    return this.usersService.addRoles(id, assignRolesDto, req.user.id);
  }

  @Delete(':id/roles/:roleId')
  @Permissions(PERMISSIONS.ROLES.ASSIGN)
  removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Request() req,
  ) {
    return this.usersService.removeRole(id, roleId, req.user.id);
  }
}
