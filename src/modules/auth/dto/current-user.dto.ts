import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../common/dto/enums.dto';

export class CurrentUserResponseDto {
  @ApiProperty({ example: 'user_21' })
  user_id: string;

  @ApiProperty({ enum: RoleName, isArray: true, example: ['PAYROLL_CLERK', 'PAYROLL_MANAGER'] })
  roles: RoleName[];

  @ApiProperty({ type: [String], example: ['payrun:create', 'payrun:approve'] })
  permissions: string[];

  @ApiProperty({ type: [String], example: ['le_za_001', 'le_ls_001'] })
  legal_entity_access: string[];
}
