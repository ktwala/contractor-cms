import { ApiProperty } from '@nestjs/swagger';
import { SupplierStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SupplierStatusTransitionDto {
  @ApiProperty({ enum: SupplierStatus, description: 'Target lifecycle status' })
  @IsEnum(SupplierStatus)
  targetStatus: SupplierStatus;

  @ApiProperty({
    required: false,
    description: 'Reason or notes for the transition (audit metadata)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
