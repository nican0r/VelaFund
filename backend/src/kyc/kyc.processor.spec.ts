import { Test, TestingModule } from '@nestjs/testing';
import { KycProcessor, AmlScreeningPayload } from './kyc.processor';
import { KycService } from './kyc.service';
import { Job } from 'bull';

const mockKycService = {
  processAmlScreening: jest.fn(),
};

describe('KycProcessor', () => {
  let processor: KycProcessor;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycProcessor,
        { provide: KycService, useValue: mockKycService },
      ],
    }).compile();

    processor = module.get<KycProcessor>(KycProcessor);

    // Spy on the logger to verify logging behavior
    loggerDebugSpy = jest.spyOn(
      (processor as any).logger,
      'debug',
    );
  });

  describe('handleAmlScreening', () => {
    const fullPayload: AmlScreeningPayload = {
      kycVerificationId: 'kyc-uuid-123',
      userId: 'user-uuid-456',
      fullName: 'Joao Silva',
      cpf: '123.456.789-00',
      nationality: 'BR',
    };

    function createMockJob(
      data: Partial<AmlScreeningPayload> & { kycVerificationId: string },
      jobId: string | number = 'job-1',
    ): Job<AmlScreeningPayload> {
      return {
        id: jobId,
        data,
      } as unknown as Job<AmlScreeningPayload>;
    }

    it('should call processAmlScreening with kycVerificationId from job data', async () => {
      const mockJob = createMockJob(fullPayload);
      mockKycService.processAmlScreening.mockResolvedValueOnce(undefined);

      await processor.handleAmlScreening(mockJob);

      expect(mockKycService.processAmlScreening).toHaveBeenCalledTimes(1);
      expect(mockKycService.processAmlScreening).toHaveBeenCalledWith(
        'kyc-uuid-123',
      );
    });

    it('should handle successful processing without throwing', async () => {
      const mockJob = createMockJob(fullPayload);
      mockKycService.processAmlScreening.mockResolvedValueOnce(undefined);

      await expect(
        processor.handleAmlScreening(mockJob),
      ).resolves.toBeUndefined();
    });

    it('should propagate errors from service for Bull retry', async () => {
      const mockJob = createMockJob(fullPayload, 'job-fail');
      const error = new Error('Database connection lost');
      mockKycService.processAmlScreening.mockRejectedValueOnce(error);

      await expect(
        processor.handleAmlScreening(mockJob),
      ).rejects.toThrow('Database connection lost');
    });

    it('should log job processing start with job id, kycVerificationId, and userId', async () => {
      const mockJob = createMockJob(fullPayload, 'job-42');
      mockKycService.processAmlScreening.mockResolvedValueOnce(undefined);

      await processor.handleAmlScreening(mockJob);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('job-42'),
      );
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('kyc-uuid-123'),
      );
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('user-uuid-456'),
      );
    });

    it('should log job completion after successful processing', async () => {
      const mockJob = createMockJob(fullPayload, 'job-99');
      mockKycService.processAmlScreening.mockResolvedValueOnce(undefined);

      await processor.handleAmlScreening(mockJob);

      // The second debug call should indicate completion
      expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
      expect(loggerDebugSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('completed'),
      );
      expect(loggerDebugSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('job-99'),
      );
    });

    it('should work with minimal job data (only kycVerificationId and userId)', async () => {
      const minimalPayload = {
        kycVerificationId: 'kyc-minimal-id',
        userId: 'user-minimal-id',
      } as AmlScreeningPayload;
      const mockJob = createMockJob(minimalPayload, 'job-min');
      mockKycService.processAmlScreening.mockResolvedValueOnce(undefined);

      await processor.handleAmlScreening(mockJob);

      expect(mockKycService.processAmlScreening).toHaveBeenCalledWith(
        'kyc-minimal-id',
      );
    });

    it('should not log completion when service throws', async () => {
      const mockJob = createMockJob(fullPayload, 'job-err');
      mockKycService.processAmlScreening.mockRejectedValueOnce(
        new Error('Verifik timeout'),
      );

      await expect(
        processor.handleAmlScreening(mockJob),
      ).rejects.toThrow('Verifik timeout');

      // Only the start log should have been called, not the completion log
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing AML screening'),
      );
    });

    it('should propagate non-Error exceptions from service', async () => {
      const mockJob = createMockJob(fullPayload, 'job-str');
      mockKycService.processAmlScreening.mockRejectedValueOnce(
        'unexpected string error',
      );

      await expect(
        processor.handleAmlScreening(mockJob),
      ).rejects.toBe('unexpected string error');
    });
  });
});
