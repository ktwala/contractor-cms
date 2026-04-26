import { PartialType } from '@nestjs/swagger';
import { CreateTimesheetDto } from './create-timesheet.dto';

export class UpdateTimesheetDto extends PartialType(CreateTimesheetDto) {}
