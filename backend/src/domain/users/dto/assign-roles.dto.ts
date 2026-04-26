import { IsArray, IsString } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
