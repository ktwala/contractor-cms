import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /**
   * Hash password using Argon2
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if password needs rehashing (e.g., if params changed)
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }
}
