import { ApiProperty } from '@nestjs/swagger';

class DemoSupplierSetupMembershipDto {
  @ApiProperty({ example: 'supplier.admin@ewp.demo' })
  userEmail!: string;

  @ApiProperty({ example: 'ADMIN' })
  role!: string;
}

class DemoSupplierSetupContractDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'DEMO-SEED-001' })
  contractNumber!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({
    description: 'True when a new contract row was created; false when an existing row was refreshed',
  })
  created!: boolean;
}

export class DemoSupplierSetupResponseDto {
  @ApiProperty()
  supplierId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  supplierStatus!: string;

  @ApiProperty({
    description: 'True when the supplier was moved to ACTIVE as part of this helper',
  })
  supplierActivated!: boolean;

  @ApiProperty({
    description:
      'External workers removed from the Atlas supplier portal scope before seeding membership and contract',
  })
  portalWorkersRemoved!: number;

  @ApiProperty({ type: DemoSupplierSetupMembershipDto })
  portalMembership!: DemoSupplierSetupMembershipDto;

  @ApiProperty({ type: DemoSupplierSetupContractDto })
  contract!: DemoSupplierSetupContractDto;
}
