import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KmsService } from './kms.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-kms', () => ({
  KMSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  EncryptCommand: jest.fn().mockImplementation((input) => ({ input })),
  DecryptCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('KmsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when AWS credentials and KMS key are configured', () => {
    let service: KmsService;
    const testKeyArn = 'arn:aws:kms:sa-east-1:123456:key/test-key-id';

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  AWS_REGION: 'sa-east-1',
                  AWS_ACCESS_KEY_ID: 'test-access-key',
                  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
                  AWS_KMS_KEY_ARN: testKeyArn,
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<KmsService>(KmsService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report as available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return key ARN', () => {
      expect(service.getKeyArn()).toBe(testKeyArn);
    });

    describe('encrypt', () => {
      it('should encrypt plaintext using default key ARN', async () => {
        const ciphertext = Buffer.from('encrypted-data');
        mockSend.mockResolvedValue({ CiphertextBlob: ciphertext });

        const result = await service.encrypt('sensitive-data');

        expect(result).toEqual(ciphertext);
        expect(mockSend).toHaveBeenCalledTimes(1);

        const { EncryptCommand } = require('@aws-sdk/client-kms');
        const call = EncryptCommand.mock.calls[0][0];
        expect(call.KeyId).toBe(testKeyArn);
        expect(Buffer.from(call.Plaintext).toString('utf-8')).toBe('sensitive-data');
      });

      it('should encrypt using custom key ARN', async () => {
        const customArn = 'arn:aws:kms:sa-east-1:123456:key/custom-key';
        mockSend.mockResolvedValue({
          CiphertextBlob: Buffer.from('encrypted'),
        });

        await service.encrypt('data', customArn);

        const { EncryptCommand } = require('@aws-sdk/client-kms');
        const call = EncryptCommand.mock.calls[0][0];
        expect(call.KeyId).toBe(customArn);
      });

      it('should throw on empty CiphertextBlob', async () => {
        mockSend.mockResolvedValue({ CiphertextBlob: null });

        await expect(service.encrypt('data')).rejects.toThrow(
          'KMS encrypt returned empty CiphertextBlob',
        );
      });

      it('should propagate KMS errors', async () => {
        mockSend.mockRejectedValue(new Error('DisabledException: Key is disabled'));

        await expect(service.encrypt('data')).rejects.toThrow('DisabledException');
      });
    });

    describe('decrypt', () => {
      it('should decrypt ciphertext', async () => {
        const plaintext = Buffer.from('decrypted-data', 'utf-8');
        mockSend.mockResolvedValue({ Plaintext: plaintext });

        const result = await service.decrypt(Buffer.from('encrypted-data'));

        expect(result).toBe('decrypted-data');
        expect(mockSend).toHaveBeenCalledTimes(1);
      });

      it('should throw on empty Plaintext', async () => {
        mockSend.mockResolvedValue({ Plaintext: null });

        await expect(service.decrypt(Buffer.from('encrypted'))).rejects.toThrow(
          'KMS decrypt returned empty Plaintext',
        );
      });

      it('should propagate KMS decrypt errors', async () => {
        mockSend.mockRejectedValue(new Error('InvalidCiphertextException'));

        await expect(service.decrypt(Buffer.from('bad-data'))).rejects.toThrow(
          'InvalidCiphertextException',
        );
      });
    });

    describe('encrypt/decrypt roundtrip', () => {
      it('should encrypt and decrypt back to original value', async () => {
        const original = '123.456.789-09';
        const encryptedBuffer = Buffer.from('mock-encrypted');

        // Mock encrypt
        mockSend.mockResolvedValueOnce({
          CiphertextBlob: encryptedBuffer,
        });

        const encrypted = await service.encrypt(original);

        // Mock decrypt
        mockSend.mockResolvedValueOnce({
          Plaintext: Buffer.from(original, 'utf-8'),
        });

        const decrypted = await service.decrypt(encrypted);

        expect(decrypted).toBe(original);
      });
    });
  });

  describe('when AWS credentials are configured but KMS key ARN is missing', () => {
    let service: KmsService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  AWS_REGION: 'sa-east-1',
                  AWS_ACCESS_KEY_ID: 'test-key',
                  AWS_SECRET_ACCESS_KEY: 'test-secret',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<KmsService>(KmsService);
    });

    it('should report as unavailable', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return undefined for key ARN', () => {
      expect(service.getKeyArn()).toBeUndefined();
    });

    it('should throw on encrypt with missing key ARN', async () => {
      await expect(service.encrypt('data')).rejects.toThrow('KMS key ARN not configured');
    });
  });

  describe('when AWS credentials are not configured', () => {
    let service: KmsService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
        ],
      }).compile();

      service = module.get<KmsService>(KmsService);
    });

    it('should report as unavailable', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should throw on encrypt when not configured', async () => {
      await expect(service.encrypt('data')).rejects.toThrow('KMS client not initialized');
    });

    it('should throw on decrypt when not configured', async () => {
      await expect(service.decrypt(Buffer.from('encrypted'))).rejects.toThrow(
        'KMS client not initialized',
      );
    });
  });
});
