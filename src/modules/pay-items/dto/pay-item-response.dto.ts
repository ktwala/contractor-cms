import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayItemType } from '../../../common/dto/enums.dto';

export class PayItemResponseDto {
  @ApiProperty({ example: 'pi_1' })
  id: string;

  @ApiProperty({ example: 'BASIC' })
  code: string;

  @ApiProperty({ example: 'Basic Salary' })
  name: string;

  @ApiProperty({ enum: PayItemType, example: PayItemType.EARNING })
  type: PayItemType;

  @ApiProperty({ example: true })
  taxable: boolean;

  @ApiPropertyOptional({ example: '5000' })
  gl_account?: string;

  @ApiProperty({ example: 100 })
  sort_order: number;

  @ApiPropertyOptional()
  country_attributes?: {
    LS?: {
      taxable?: boolean;
      statutory_category?: string;
    };
    ZA?: {
      taxable?: boolean;
      uif_applicable?: boolean;
      sdl_applicable?: boolean;
      irp5_code?: string;
      pensionable?: boolean;
    };
  };

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class ListPayItemsResponseDto {
  @ApiProperty({ type: [PayItemResponseDto] })
  items: PayItemResponseDto[];
}
