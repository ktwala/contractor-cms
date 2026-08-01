import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class ApproveChangeRequestDto {
  @ApiPropertyOptional({ example: 'Verified with employee via phone call' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectChangeRequestDto {
  @ApiProperty({ example: 'Bank account details could not be verified' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

export class CancelChangeRequestDto {
  @ApiProperty({ example: 'Employee withdrew the request' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
