import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadBucketCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.presigned.url/test'),
}));

describe('S3Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when AWS credentials are configured', () => {
    let service: S3Service;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          S3Service,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  AWS_REGION: 'sa-east-1',
                  AWS_ACCESS_KEY_ID: 'test-access-key',
                  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
                  AWS_S3_DOCUMENTS_BUCKET: 'navia-documents',
                  AWS_S3_KYC_BUCKET: 'navia-kyc',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<S3Service>(S3Service);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report as available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return documents bucket name', () => {
      expect(service.getDocumentsBucket()).toBe('navia-documents');
    });

    it('should return KYC bucket name', () => {
      expect(service.getKycBucket()).toBe('navia-kyc');
    });

    describe('upload', () => {
      it('should upload a file to S3', async () => {
        mockSend.mockResolvedValue({});
        const buffer = Buffer.from('test content');

        await service.upload('navia-documents', 'test/file.pdf', buffer, {
          contentType: 'application/pdf',
        });

        expect(mockSend).toHaveBeenCalledTimes(1);
        const command = mockSend.mock.calls[0][0];
        expect(command.input).toEqual({
          Bucket: 'navia-documents',
          Key: 'test/file.pdf',
          Body: buffer,
          ContentType: 'application/pdf',
          ServerSideEncryption: undefined,
          SSEKMSKeyId: undefined,
          Metadata: undefined,
        });
      });

      it('should upload with KMS encryption', async () => {
        mockSend.mockResolvedValue({});
        const buffer = Buffer.from('sensitive data');

        await service.upload('navia-kyc', 'kyc/doc.pdf', buffer, {
          contentType: 'application/pdf',
          serverSideEncryption: 'aws:kms',
          kmsKeyId: 'arn:aws:kms:sa-east-1:123:key/test-key',
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.ServerSideEncryption).toBe('aws:kms');
        expect(command.input.SSEKMSKeyId).toBe(
          'arn:aws:kms:sa-east-1:123:key/test-key',
        );
      });

      it('should upload with custom metadata', async () => {
        mockSend.mockResolvedValue({});
        const buffer = Buffer.from('test');

        await service.upload('navia-documents', 'test.pdf', buffer, {
          metadata: { 'x-uploaded-by': 'user-123' },
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.Metadata).toEqual({
          'x-uploaded-by': 'user-123',
        });
      });

      it('should propagate S3 errors', async () => {
        mockSend.mockRejectedValue(new Error('Access Denied'));

        await expect(
          service.upload(
            'navia-documents',
            'test.pdf',
            Buffer.from('test'),
          ),
        ).rejects.toThrow('Access Denied');
      });
    });

    describe('download', () => {
      it('should download a file from S3', async () => {
        const content = Buffer.from('file content');
        mockSend.mockResolvedValue({
          Body: (async function* () {
            yield content;
          })(),
        });

        const result = await service.download('navia-documents', 'test.pdf');

        expect(result).toEqual(content);
        expect(mockSend).toHaveBeenCalledTimes(1);
      });

      it('should handle multi-chunk downloads', async () => {
        const chunk1 = Buffer.from('hello ');
        const chunk2 = Buffer.from('world');
        mockSend.mockResolvedValue({
          Body: (async function* () {
            yield chunk1;
            yield chunk2;
          })(),
        });

        const result = await service.download('navia-documents', 'large.pdf');

        expect(result.toString()).toBe('hello world');
      });

      it('should throw on empty response body', async () => {
        mockSend.mockResolvedValue({ Body: null });

        await expect(
          service.download('navia-documents', 'missing.pdf'),
        ).rejects.toThrow('Empty response body');
      });
    });

    describe('delete', () => {
      it('should delete an object from S3', async () => {
        mockSend.mockResolvedValue({});

        await service.delete('navia-documents', 'test.pdf');

        expect(mockSend).toHaveBeenCalledTimes(1);
        const command = mockSend.mock.calls[0][0];
        expect(command.input).toEqual({
          Bucket: 'navia-documents',
          Key: 'test.pdf',
        });
      });

      it('should propagate S3 delete errors', async () => {
        mockSend.mockRejectedValue(new Error('NoSuchKey'));

        await expect(
          service.delete('navia-documents', 'nonexistent.pdf'),
        ).rejects.toThrow('NoSuchKey');
      });
    });

    describe('generatePresignedUrl', () => {
      it('should generate a presigned URL with default 15-min expiry', async () => {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

        const url = await service.generatePresignedUrl(
          'navia-documents',
          'test.pdf',
        );

        expect(url).toBe('https://s3.presigned.url/test');
        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          { expiresIn: 900 },
        );
      });

      it('should accept custom expiry seconds', async () => {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

        await service.generatePresignedUrl(
          'navia-documents',
          'test.pdf',
          3600,
        );

        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          { expiresIn: 3600 },
        );
      });
    });

    describe('checkBucketHealth', () => {
      it('should return true when bucket is accessible', async () => {
        mockSend.mockResolvedValue({});

        const healthy = await service.checkBucketHealth('navia-documents');

        expect(healthy).toBe(true);
      });

      it('should return false when bucket is not accessible', async () => {
        mockSend.mockRejectedValue(new Error('NoSuchBucket'));

        const healthy = await service.checkBucketHealth('nonexistent-bucket');

        expect(healthy).toBe(false);
      });
    });
  });

  describe('when AWS credentials are not configured', () => {
    let service: S3Service;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          S3Service,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
        ],
      }).compile();

      service = module.get<S3Service>(S3Service);
    });

    it('should report as unavailable', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should throw on upload when not configured', async () => {
      await expect(
        service.upload('bucket', 'key', Buffer.from('test')),
      ).rejects.toThrow('S3 client not initialized');
    });

    it('should throw on download when not configured', async () => {
      await expect(service.download('bucket', 'key')).rejects.toThrow(
        'S3 client not initialized',
      );
    });

    it('should throw on delete when not configured', async () => {
      await expect(service.delete('bucket', 'key')).rejects.toThrow(
        'S3 client not initialized',
      );
    });

    it('should throw on generatePresignedUrl when not configured', async () => {
      await expect(
        service.generatePresignedUrl('bucket', 'key'),
      ).rejects.toThrow('S3 client not initialized');
    });

    it('should return false for checkBucketHealth when not configured', async () => {
      const result = await service.checkBucketHealth('bucket');
      expect(result).toBe(false);
    });
  });
});
