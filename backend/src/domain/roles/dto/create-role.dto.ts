import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  // isSystemRole is specifically NOT included so it cannot be created via API.
}
