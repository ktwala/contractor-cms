import { ApiProperty } from '@nestjs/swagger';

class MtnStorySupplierSetupResultDto {
  @ApiProperty({ example: 'ORCL-SUP-MTN-001' })
  externalSupplierId!: string;

  @ApiProperty({ example: 'Atlas Consulting' })
  tradingName!: string;

  @ApiProperty()
  supplierId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 'MTN-FWA-001' })
  contractNumber!: string;

  @ApiProperty({ example: 'supplier.admin@atlas.demo' })
  portalAdminEmail!: string;

  @ApiProperty()
  promoted!: boolean;
}

class MtnStoryMaterializeResultDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  skipped!: number;
}

export class DemoMtnStorySetupResponseDto {
  @ApiProperty({ type: [MtnStorySupplierSetupResultDto] })
  suppliers!: MtnStorySupplierSetupResultDto[];

  @ApiProperty({ type: MtnStoryMaterializeResultDto })
  materialized!: MtnStoryMaterializeResultDto;

  @ApiProperty()
  engagementsCreated!: number;

  @ApiProperty()
  sponsoredWorkers!: number;

  @ApiProperty()
  skippedMissingResponsibleManagerWorkers!: number;
}
