import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        ENCRYPTION_MASTER_KEY: 'test-master-key-at-least-32-characters-long-for-security',
        ENCRYPTION_SALT: 'test-salt-for-testing',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = '1234567890';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plaintext);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext format
    });

    it('should throw error if encryption key is not initialized', () => {
      // Create a new service with no master key
      const mockNoKeyConfig = {
        get: jest.fn(() => undefined),
      };

      const testModule = Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: mockNoKeyConfig,
          },
        ],
      }).compile();

      testModule.then((module) => {
        const noKeyService = module.get<CryptoService>(CryptoService);
        expect(() => noKeyService.encrypt('test')).toThrow('Encryption key not initialized');
      });
    });

    it('should throw error for empty plaintext', () => {
      expect(() => service.encrypt('')).toThrow('Cannot encrypt empty or null value');
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const plaintext = '1234567890';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toEqual(encrypted2); // Different IVs
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string', () => {
      const plaintext = '1234567890';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(plaintext);
    });

    it('should decrypt complex strings with special characters', () => {
      const plaintext = 'Account#12345-6789@Test!';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(plaintext);
    });

    it('should throw error for invalid format (not 3 parts)', () => {
      const invalidCiphertext = 'invalid:format';
      expect(() => service.decrypt(invalidCiphertext)).toThrow(
        /Invalid encrypted format/,
      );
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = '1234567890';
      const encrypted = service.encrypt(plaintext);

      // Tamper with the encrypted string
      const parts = encrypted.split(':');
      parts[2] = 'tampered';
      const tamperedCiphertext = parts.join(':');

      expect(() => service.decrypt(tamperedCiphertext)).toThrow(/Decryption failed/);
    });

    it('should throw error for empty ciphertext', () => {
      expect(() => service.decrypt('')).toThrow('Cannot decrypt empty or null value');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const plaintext = '1234567890';
      const encrypted = service.encrypt(plaintext);

      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext values', () => {
      expect(service.isEncrypted('plaintext')).toBe(false);
      expect(service.isEncrypted('1234567890')).toBe(false);
    });

    it('should return false for invalid formats', () => {
      expect(service.isEncrypted('invalid:format')).toBe(false);
      expect(service.isEncrypted('a:b:c')).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
    });
  });

  describe('getEncryptionStatus', () => {
    it('should return encryption status', () => {
      const status = service.getEncryptionStatus();

      expect(status).toEqual({
        isEnabled: true,
        algorithm: 'aes-256-gcm',
        keyLength: 256, // bits
      });
    });
  });

  describe('end-to-end encryption', () => {
    it('should handle bank account numbers', () => {
      const accountNumber = '1234567890123456';
      const encrypted = service.encrypt(accountNumber);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(accountNumber);
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should handle multiple encryptions and decryptions', () => {
      const testData = [
        '1234567890',
        '0987654321',
        '1111222233334444',
        'ZA-1234567890',
      ];

      const encrypted = testData.map((data) => service.encrypt(data));
      const decrypted = encrypted.map((enc) => service.decrypt(enc));

      expect(decrypted).toEqual(testData);
    });
  });
});
