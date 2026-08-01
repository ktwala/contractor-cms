import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [BootstrapController],
  providers: [BootstrapService],
})
export class BootstrapModule {}
