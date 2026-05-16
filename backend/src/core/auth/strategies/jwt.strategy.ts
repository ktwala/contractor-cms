import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  type: string;
  organizationId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const secret = configService.get<string>('jwt.secret') || 'default_secret';
    console.log('JwtStrategy initialized with secret:', secret);
    super({
      jwtFromRequest: (req) => {
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        console.log('Extracted token:', token ? `${token.substring(0, 15)}... length=${token.length}` : token);
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log('Validating payload:', payload);
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
