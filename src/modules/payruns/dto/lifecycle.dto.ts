import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class RevertToDraftRequestDto {
  @ApiProperty({ example: 'Need to correct overtime import' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CancelPayrunRequestDto {
  @ApiProperty({ example: 'Duplicate run — abandon before approval' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class MarkPaidRequestDto {
  @ApiProperty({ example: '2026-01-25T14:30:00.000Z' })
  @IsDateString()
  paid_at: string;

  @ApiProperty({ example: 'PAY-REF-2026-01' })
  @IsString()
  @IsNotEmpty()
  payment_reference: string;
}

export class MarkPostedRequestDto {
  @ApiProperty({ example: '2026-01-25T15:00:00.000Z' })
  @IsDateString()
  posted_at: string;

  @ApiProperty({ example: 'GL-JNL-2026-01-001' })
  @IsString()
  @IsNotEmpty()
  gl_reference: string;
}
