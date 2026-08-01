import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileDashboardController } from './mobile-dashboard.controller';
import { MobileEmployeeController } from './mobile-employee.controller';
import { MobileTimesheetController } from './mobile-timesheet.controller';
import { MobileAuthService } from './mobile-auth.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [
    MobileAuthController,
    MobileDashboardController,
    MobileEmployeeController,
    MobileTimesheetController,
  ],
  providers: [MobileAuthService, PushNotificationService],
  exports: [MobileAuthService, PushNotificationService],
})
export class MobileModule {}
