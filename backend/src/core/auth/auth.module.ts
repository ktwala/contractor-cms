import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { ApiKeyService } from './services/api-key.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { DatabaseModule } from '../database/database.module';
import { OrgContextResolverService } from './guards/org-context-resolver.service';

@Global()
@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        console.log('JwtModule initialized with secret:', secret);
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<any>('jwt.expiresIn'),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    ApiKeyService,
    LocalStrategy,
    JwtStrategy,
    ApiKeyStrategy,
    OrgContextResolverService,
  ],
  exports: [AuthService, PasswordService, ApiKeyService, OrgContextResolverService],
})
export class AuthModule {}
