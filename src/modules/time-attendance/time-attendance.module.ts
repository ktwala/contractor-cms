import { Module } from '@nestjs/common';
import { TimeAttendanceController } from './time-attendance.controller';
import { TimeAttendanceService } from './services/time-attendance.service';

@Module({
  controllers: [TimeAttendanceController],
  providers: [TimeAttendanceService],
  exports: [TimeAttendanceService],
})
export class TimeAttendanceModule {}
