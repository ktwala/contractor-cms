import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/** Password rules for first admin: 12+ chars, upper, lower, number, special. */
const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()[\]\-_+=.,;:'"`~]).{12,}$/;

export class BootstrapAdminDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(12, {
    message: 'Password must be at least 12 characters',
  })
  @Matches(PASSWORD_RULES, {
    message:
      'Password must include uppercase, lowercase, number, and special character (@$!%*?&# etc.)',
  })
  password: string;
}
