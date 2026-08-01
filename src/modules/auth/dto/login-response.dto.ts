import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: '24h' })
  expires_in: string;

  @ApiProperty({
    example: {
      user_id: 'uuid-here',
      email: 'admin@demo.workforce',
      first_name: 'Demo',
      last_name: 'Admin',
      roles: ['TENANT_ADMIN', 'PAYROLL_CLERK'],
      permissions: ['payrun:read', 'payrun:write'],
      legal_entity_access: ['legal-entity-uuid'],
    },
  })
  user: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    roles: string[];
    permissions: string[];
    legal_entity_access: string[];
  };
}
