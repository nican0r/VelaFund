import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { EncryptionService } from './encryption.service';
import { KmsService } from '../aws/kms.service';

describe('EncryptionService', () => {
  const BLIND_INDEX_KEY = 'test-blind-index-key-32-bytes-ok';
  let service: EncryptionService;
  let kmsService: jest.Mocked<Partial<KmsService>>;
  let configService: Partial<ConfigService>;

  // ─── WITH BLIND INDEX KEY ─────────────────────────────────────────

  describe('with BLIND_INDEX_KEY configured', () => {
    beforeEach(async () => {
      kmsService = {
        isAvailable: jest.fn().mockReturnValue(true),
        encrypt: jest.fn().mockResolvedValue(Buffer.from('encrypted-data')),
        decrypt: jest.fn().mockResolvedValue('decrypted-plaintext'),
      };

      configService = {
        get: jest.fn((key: string) => {
          if (key === 'BLIND_INDEX_KEY') return BLIND_INDEX_KEY;
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: KmsService, useValue: kmsService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    // ─── isEncryptionAvailable ────────────────────────────────────

    it('should report encryption available when KMS is available', () => {
      expect(service.isEncryptionAvailable()).toBe(true);
    });

    // ─── isBlindIndexSecure ───────────────────────────────────────

    it('should report blind index secure when key is configured', () => {
      expect(service.isBlindIndexSecure()).toBe(true);
    });

    // ─── encrypt ──────────────────────────────────────────────────

    it('should delegate encryption to KmsService', async () => {
      const result = await service.encrypt('my-secret-cpf');

      expect(kmsService.encrypt).toHaveBeenCalledWith('my-secret-cpf');
      expect(result).toEqual(Buffer.from('encrypted-data'));
    });

    it('should propagate KmsService encrypt errors', async () => {
      (kmsService.encrypt as jest.Mock).mockRejectedValue(new Error('KMS error'));

      await expect(service.encrypt('test')).rejects.toThrow('KMS error');
    });

    // ─── decrypt ──────────────────────────────────────────────────

    it('should delegate decryption to KmsService', async () => {
      const ciphertext = Buffer.from('encrypted-data');
      const result = await service.decrypt(ciphertext);

      expect(kmsService.decrypt).toHaveBeenCalledWith(ciphertext);
      expect(result).toBe('decrypted-plaintext');
    });

    it('should propagate KmsService decrypt errors', async () => {
      (kmsService.decrypt as jest.Mock).mockRejectedValue(new Error('KMS decrypt error'));

      await expect(service.decrypt(Buffer.from('bad-data'))).rejects.toThrow('KMS decrypt error');
    });

    // ─── createBlindIndex (HMAC mode) ─────────────────────────────

    it('should create HMAC-SHA256 blind index', () => {
      const index = service.createBlindIndex('529.982.247-25');

      // Compute expected value
      const expected = createHmac('sha256', BLIND_INDEX_KEY)
        .update('52998224725')
        .digest('hex')
        .slice(0, 32);

      expect(index).toBe(expected);
      expect(index).toHaveLength(32);
    });

    it('should normalize input to digits only', () => {
      const formatted = service.createBlindIndex('529.982.247-25');
      const raw = service.createBlindIndex('52998224725');

      expect(formatted).toBe(raw);
    });

    it('should normalize CNPJ to digits only', () => {
      const formatted = service.createBlindIndex('11.222.333/0001-81');
      const raw = service.createBlindIndex('11222333000181');

      expect(formatted).toBe(raw);
    });

    it('should produce different indexes for different values', () => {
      const index1 = service.createBlindIndex('529.982.247-25');
      const index2 = service.createBlindIndex('123.456.789-09');

      expect(index1).not.toBe(index2);
    });

    it('should produce deterministic indexes', () => {
      const index1 = service.createBlindIndex('529.982.247-25');
      const index2 = service.createBlindIndex('529.982.247-25');

      expect(index1).toBe(index2);
    });

    it('should return 32-character hex string', () => {
      const index = service.createBlindIndex('529.982.247-25');

      expect(index).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  // ─── WITHOUT BLIND INDEX KEY ──────────────────────────────────────

  describe('without BLIND_INDEX_KEY (fallback mode)', () => {
    beforeEach(async () => {
      kmsService = {
        isAvailable: jest.fn().mockReturnValue(false),
        encrypt: jest.fn().mockRejectedValue(new Error('KMS not available')),
        decrypt: jest.fn().mockRejectedValue(new Error('KMS not available')),
      };

      configService = {
        get: jest.fn(() => undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: KmsService, useValue: kmsService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should report encryption unavailable', () => {
      expect(service.isEncryptionAvailable()).toBe(false);
    });

    it('should report blind index not secure', () => {
      expect(service.isBlindIndexSecure()).toBe(false);
    });

    it('should fall back to SHA-256 for blind index', () => {
      const index = service.createBlindIndex('529.982.247-25');

      const expected = createHash('sha256').update('52998224725').digest('hex').slice(0, 32);

      expect(index).toBe(expected);
    });

    it('should still normalize input in fallback mode', () => {
      const formatted = service.createBlindIndex('529.982.247-25');
      const raw = service.createBlindIndex('52998224725');

      expect(formatted).toBe(raw);
    });

    it('should produce different results from HMAC mode for same input', () => {
      // SHA-256 fallback index
      const fallbackIndex = service.createBlindIndex('529.982.247-25');

      // Manually compute HMAC index
      const hmacIndex = createHmac('sha256', BLIND_INDEX_KEY)
        .update('52998224725')
        .digest('hex')
        .slice(0, 32);

      expect(fallbackIndex).not.toBe(hmacIndex);
    });

    it('should throw when trying to encrypt without KMS', async () => {
      await expect(service.encrypt('test')).rejects.toThrow();
    });

    it('should throw when trying to decrypt without KMS', async () => {
      await expect(service.decrypt(Buffer.from('data'))).rejects.toThrow();
    });
  });

  // ─── EDGE CASES ───────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(async () => {
      kmsService = {
        isAvailable: jest.fn().mockReturnValue(true),
        encrypt: jest.fn().mockResolvedValue(Buffer.from('encrypted')),
        decrypt: jest.fn().mockResolvedValue('decrypted'),
      };

      configService = {
        get: jest.fn((key: string) => {
          if (key === 'BLIND_INDEX_KEY') return BLIND_INDEX_KEY;
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: KmsService, useValue: kmsService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should handle empty string for blind index', () => {
      const index = service.createBlindIndex('');
      expect(index).toHaveLength(32);
      expect(index).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should handle value with only non-digit characters', () => {
      const index = service.createBlindIndex('abc-def');
      // All non-digits stripped, empty string hashed
      const emptyIndex = service.createBlindIndex('');
      expect(index).toBe(emptyIndex);
    });

    it('should handle very long numeric values', () => {
      const longValue = '1'.repeat(1000);
      const index = service.createBlindIndex(longValue);
      expect(index).toHaveLength(32);
      expect(index).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should encrypt empty string', async () => {
      await service.encrypt('');
      expect(kmsService.encrypt).toHaveBeenCalledWith('');
    });

    it('should encrypt long plaintext', async () => {
      const longText = 'a'.repeat(10000);
      await service.encrypt(longText);
      expect(kmsService.encrypt).toHaveBeenCalledWith(longText);
    });

    it('should decrypt empty buffer', async () => {
      await service.decrypt(Buffer.alloc(0));
      expect(kmsService.decrypt).toHaveBeenCalledWith(Buffer.alloc(0));
    });
  });
});
