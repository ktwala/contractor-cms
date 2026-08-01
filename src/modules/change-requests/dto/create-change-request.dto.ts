import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsObject,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ChangeRequestKind } from '../../../common/dto/enums.dto';

export class CreateChangeRequestDto {
  @ApiProperty({ example: 'emp_123' })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({ enum: ChangeRequestKind, example: 'BANK_ACCOUNT' })
  @IsEnum(ChangeRequestKind)
  kind: ChangeRequestKind;

  @ApiProperty({
    example: {
      account_holder: 'John Doe',
      bank_name: 'Standard Bank',
      account_number: '1234567890',
      branch_code: '051001',
    },
    description: 'The proposed new values for the change',
  })
  @IsObject()
  proposed_values: Record<string, any>;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({ example: 'Employee requested bank account change' })
  @IsOptional()
  @IsString()
  reason?: string;
}
