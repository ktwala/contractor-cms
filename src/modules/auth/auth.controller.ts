import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CurrentUserResponseDto } from './dto/current-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Get current user identity + roles + permissions',
    description:
      'JWT only (no extra permission code). Used by the admin portal to refresh localStorage after RBAC changes. ' +
      'Authorization for mutations still uses per-route guards.',
  })
  @ApiResponse({ status: 200, description: 'Current user info', type: CurrentUserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: CurrentUserData): Promise<CurrentUserResponseDto> {
    return {
      user_id: user.sub,
      roles: user.roles as any[],
      permissions: user.permissions,
      legal_entity_access: user.legalEntityAccess,
    };
  }
}
