import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycStatus } from '@prisma/client';
import { DocumentTypeDto } from './dto/upload-document.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockUserId = 'user-uuid-123';

function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'document.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    size: 4,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('KycController', () => {
  let controller: KycController;
  let kycService: jest.Mocked<KycService>;

  beforeEach(async () => {
    const mockService = {
      startVerification: jest.fn(),
      verifyCpf: jest.fn(),
      uploadDocument: jest.fn(),
      verifyFace: jest.fn(),
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        { provide: KycService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<KycController>(KycController);
    kycService = module.get(KycService) as jest.Mocked<KycService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── START ──────────────────────────────────────────────────────────────────

  describe('start', () => {
    const mockStartResult = {
      sessionId: 'session-uuid-abc',
      status: KycStatus.IN_PROGRESS,
      requiredSteps: ['cpf', 'document', 'facial', 'aml'],
    };

    it('should start a KYC verification session and return the result', async () => {
      kycService.startVerification.mockResolvedValue(mockStartResult);

      const result = await controller.start(mockUserId);

      expect(result).toEqual(mockStartResult);
      expect(result.sessionId).toBe('session-uuid-abc');
      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(result.requiredSteps).toHaveLength(4);
    });

    it('should pass userId from @CurrentUser to the service', async () => {
      kycService.startVerification.mockResolvedValue(mockStartResult);

      await controller.start(mockUserId);

      expect(kycService.startVerification).toHaveBeenCalledTimes(1);
      expect(kycService.startVerification).toHaveBeenCalledWith(mockUserId);
    });

    it('should propagate ConflictException when KYC is already approved', async () => {
      kycService.startVerification.mockRejectedValue(
        new ConflictException('KYC_ALREADY_APPROVED', 'errors.kyc.alreadyApproved'),
      );

      await expect(controller.start(mockUserId)).rejects.toThrow(ConflictException);
      await expect(controller.start(mockUserId)).rejects.toMatchObject({
        code: 'KYC_ALREADY_APPROVED',
        messageKey: 'errors.kyc.alreadyApproved',
        statusCode: 409,
      });
    });

    it('should propagate ConflictException when KYC is under review', async () => {
      kycService.startVerification.mockRejectedValue(
        new ConflictException('KYC_UNDER_REVIEW', 'errors.kyc.underReview'),
      );

      await expect(controller.start(mockUserId)).rejects.toThrow(ConflictException);
    });

    it('should propagate BusinessRuleException when max attempts exceeded', async () => {
      kycService.startVerification.mockRejectedValue(
        new BusinessRuleException('KYC_MAX_ATTEMPTS_EXCEEDED', 'errors.kyc.maxAttemptsExceeded', {
          maxAttempts: 3,
          currentAttempts: 3,
        }),
      );

      await expect(controller.start(mockUserId)).rejects.toThrow(BusinessRuleException);
      await expect(controller.start(mockUserId)).rejects.toMatchObject({
        code: 'KYC_MAX_ATTEMPTS_EXCEEDED',
        statusCode: 422,
      });
    });
  });

  // ─── VERIFY CPF ─────────────────────────────────────────────────────────────

  describe('verifyCpf', () => {
    const mockDto = {
      cpf: '529.982.247-25',
      dateOfBirth: '15/06/1990',
      fullName: 'Maria Santos',
    };

    const mockCpfResult = {
      verified: true,
      cpfData: {
        fullName: 'Maria Santos',
        dateOfBirth: '15/06/1990',
        cpfStatus: 'REGULAR',
      },
      verifikSignature: 'sig-abc-123',
    };

    it('should verify CPF and return the result', async () => {
      kycService.verifyCpf.mockResolvedValue(mockCpfResult);

      const result = await controller.verifyCpf(mockUserId, mockDto);

      expect(result).toEqual(mockCpfResult);
      expect(result.verified).toBe(true);
      expect(result.cpfData.fullName).toBe('Maria Santos');
      expect(result.verifikSignature).toBe('sig-abc-123');
    });

    it('should pass userId and dto to the service', async () => {
      kycService.verifyCpf.mockResolvedValue(mockCpfResult);

      await controller.verifyCpf(mockUserId, mockDto);

      expect(kycService.verifyCpf).toHaveBeenCalledTimes(1);
      expect(kycService.verifyCpf).toHaveBeenCalledWith(mockUserId, mockDto);
    });

    it('should propagate BusinessRuleException for invalid CPF checksum', async () => {
      kycService.verifyCpf.mockRejectedValue(
        new BusinessRuleException('KYC_CPF_INVALID', 'errors.kyc.cpfInvalid'),
      );

      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toMatchObject({
        code: 'KYC_CPF_INVALID',
      });
    });

    it('should propagate BusinessRuleException for duplicate CPF', async () => {
      kycService.verifyCpf.mockRejectedValue(
        new BusinessRuleException('KYC_CPF_DUPLICATE', 'errors.kyc.cpfDuplicate'),
      );

      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toMatchObject({
        code: 'KYC_CPF_DUPLICATE',
      });
    });

    it('should propagate NotFoundException when no KYC record exists', async () => {
      kycService.verifyCpf.mockRejectedValue(
        new NotFoundException('kycVerification', mockUserId),
      );

      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toThrow(NotFoundException);
      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toMatchObject({
        code: 'KYCVERIFICATION_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should propagate BusinessRuleException for invalid KYC status', async () => {
      kycService.verifyCpf.mockRejectedValue(
        new BusinessRuleException('KYC_INVALID_STATUS', 'errors.kyc.invalidStatus', {
          currentStatus: KycStatus.APPROVED,
          expectedStatus: KycStatus.IN_PROGRESS,
          operation: 'verifyCpf',
        }),
      );

      await expect(controller.verifyCpf(mockUserId, mockDto)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ─── UPLOAD DOCUMENT ────────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    const mockDto = {
      documentType: DocumentTypeDto.RG,
      documentNumber: '12345678',
    };

    const mockUploadResult = {
      verified: true,
      extractedData: {
        fullName: 'Maria Santos',
        documentNumber: '12345678',
        issueDate: '10/03/2020',
        expiryDate: null as string | null,
      },
    };

    it('should pass front file buffer to the service', async () => {
      const frontFile = createMockFile({ fieldname: 'file' });
      kycService.uploadDocument.mockResolvedValue(mockUploadResult);

      const files = { file: [frontFile] };

      const result = await controller.uploadDocument(mockUserId, files, mockDto);

      expect(result).toEqual(mockUploadResult);
      expect(kycService.uploadDocument).toHaveBeenCalledWith(
        mockUserId,
        DocumentTypeDto.RG,
        '12345678',
        frontFile.buffer,
        undefined,
      );
    });

    it('should pass both front and back file buffers to the service', async () => {
      const frontFile = createMockFile({ fieldname: 'file', originalname: 'front.jpg' });
      const backFile = createMockFile({ fieldname: 'fileBack', originalname: 'back.jpg' });
      kycService.uploadDocument.mockResolvedValue(mockUploadResult);

      const files = { file: [frontFile], fileBack: [backFile] };

      await controller.uploadDocument(mockUserId, files, mockDto);

      expect(kycService.uploadDocument).toHaveBeenCalledWith(
        mockUserId,
        DocumentTypeDto.RG,
        '12345678',
        frontFile.buffer,
        backFile.buffer,
      );
    });

    it('should throw BadRequestException when no front file is provided', async () => {
      const files = {} as { file?: Express.Multer.File[]; fileBack?: Express.Multer.File[] };

      await expect(
        controller.uploadDocument(mockUserId, files, mockDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when files object is undefined', async () => {
      await expect(
        controller.uploadDocument(mockUserId, undefined as any, mockDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file array is empty', async () => {
      const files = { file: [] as Express.Multer.File[] };

      await expect(
        controller.uploadDocument(mockUserId, files, mockDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include error code and messageKey in BadRequestException', async () => {
      const files = {} as { file?: Express.Multer.File[]; fileBack?: Express.Multer.File[] };

      try {
        await controller.uploadDocument(mockUserId, files, mockDto);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({
          code: 'VAL_INVALID_INPUT',
          messageKey: 'errors.kyc.documentFileMissing',
        });
      }
    });

    it('should handle missing fileBack gracefully (passes undefined)', async () => {
      const frontFile = createMockFile();
      kycService.uploadDocument.mockResolvedValue(mockUploadResult);

      const files = { file: [frontFile] };

      await controller.uploadDocument(mockUserId, files, mockDto);

      // Verify that undefined is passed for the back file buffer
      expect(kycService.uploadDocument).toHaveBeenCalledWith(
        mockUserId,
        DocumentTypeDto.RG,
        '12345678',
        frontFile.buffer,
        undefined,
      );
    });

    it('should work with CNH document type', async () => {
      const frontFile = createMockFile();
      const dto = { documentType: DocumentTypeDto.CNH, documentNumber: 'CNH-999' };
      kycService.uploadDocument.mockResolvedValue(mockUploadResult);

      const files = { file: [frontFile] };

      await controller.uploadDocument(mockUserId, files, dto);

      expect(kycService.uploadDocument).toHaveBeenCalledWith(
        mockUserId,
        DocumentTypeDto.CNH,
        'CNH-999',
        frontFile.buffer,
        undefined,
      );
    });

    it('should work with PASSPORT document type', async () => {
      const frontFile = createMockFile();
      const dto = { documentType: DocumentTypeDto.PASSPORT, documentNumber: 'AB123456' };
      kycService.uploadDocument.mockResolvedValue(mockUploadResult);

      const files = { file: [frontFile] };

      await controller.uploadDocument(mockUserId, files, dto);

      expect(kycService.uploadDocument).toHaveBeenCalledWith(
        mockUserId,
        DocumentTypeDto.PASSPORT,
        'AB123456',
        frontFile.buffer,
        undefined,
      );
    });

    it('should propagate BusinessRuleException for step order violation', async () => {
      const frontFile = createMockFile();
      kycService.uploadDocument.mockRejectedValue(
        new BusinessRuleException('KYC_STEP_ORDER_VIOLATION', 'errors.kyc.stepOrderViolation', {
          requiredStep: 'cpf',
          currentStep: 'document',
        }),
      );

      const files = { file: [frontFile] };

      await expect(
        controller.uploadDocument(mockUserId, files, mockDto),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        controller.uploadDocument(mockUserId, files, mockDto),
      ).rejects.toMatchObject({
        code: 'KYC_STEP_ORDER_VIOLATION',
      });
    });

    it('should propagate BusinessRuleException for expired document', async () => {
      const frontFile = createMockFile();
      kycService.uploadDocument.mockRejectedValue(
        new BusinessRuleException('KYC_DOCUMENT_EXPIRED', 'errors.kyc.documentExpired', {
          expiryDate: '15/01/2020',
        }),
      );

      const files = { file: [frontFile] };

      await expect(
        controller.uploadDocument(mockUserId, files, mockDto),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should not call the service when front file is missing', async () => {
      const files = {} as { file?: Express.Multer.File[]; fileBack?: Express.Multer.File[] };

      try {
        await controller.uploadDocument(mockUserId, files, mockDto);
      } catch {
        // expected
      }

      expect(kycService.uploadDocument).not.toHaveBeenCalled();
    });
  });

  // ─── VERIFY FACE ────────────────────────────────────────────────────────────

  describe('verifyFace', () => {
    const mockFaceResult = {
      verified: true,
      faceMatchScore: 95.5,
      livenessScore: 92.0,
    };

    it('should pass selfie buffer to the service and return the result', async () => {
      const selfieFile = createMockFile({
        fieldname: 'selfie',
        originalname: 'selfie.jpg',
      });
      kycService.verifyFace.mockResolvedValue(mockFaceResult);

      const result = await controller.verifyFace(mockUserId, selfieFile);

      expect(result).toEqual(mockFaceResult);
      expect(result.verified).toBe(true);
      expect(result.faceMatchScore).toBe(95.5);
      expect(result.livenessScore).toBe(92.0);
    });

    it('should pass userId and selfie buffer to the service', async () => {
      const selfieFile = createMockFile({ fieldname: 'selfie' });
      kycService.verifyFace.mockResolvedValue(mockFaceResult);

      await controller.verifyFace(mockUserId, selfieFile);

      expect(kycService.verifyFace).toHaveBeenCalledTimes(1);
      expect(kycService.verifyFace).toHaveBeenCalledWith(mockUserId, selfieFile.buffer);
    });

    it('should throw BadRequestException when no selfie file is provided', async () => {
      await expect(
        controller.verifyFace(mockUserId, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when selfie is null', async () => {
      await expect(
        controller.verifyFace(mockUserId, null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include error code and messageKey in BadRequestException for missing selfie', async () => {
      try {
        await controller.verifyFace(mockUserId, undefined as any);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({
          code: 'VAL_INVALID_INPUT',
          messageKey: 'errors.kyc.selfieMissing',
        });
      }
    });

    it('should not call the service when selfie is missing', async () => {
      try {
        await controller.verifyFace(mockUserId, undefined as any);
      } catch {
        // expected
      }

      expect(kycService.verifyFace).not.toHaveBeenCalled();
    });

    it('should propagate BusinessRuleException for face match failure', async () => {
      const selfieFile = createMockFile({ fieldname: 'selfie' });
      kycService.verifyFace.mockRejectedValue(
        new BusinessRuleException('KYC_FACE_MATCH_FAILED', 'errors.kyc.faceMatchFailed', {
          faceMatchScore: 60,
          threshold: 85,
        }),
      );

      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toMatchObject({
        code: 'KYC_FACE_MATCH_FAILED',
      });
    });

    it('should propagate BusinessRuleException for liveness check failure', async () => {
      const selfieFile = createMockFile({ fieldname: 'selfie' });
      kycService.verifyFace.mockRejectedValue(
        new BusinessRuleException('KYC_LIVENESS_CHECK_FAILED', 'errors.kyc.livenessCheckFailed', {
          livenessScore: 50,
          threshold: 80,
        }),
      );

      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should propagate BusinessRuleException for step order violation', async () => {
      const selfieFile = createMockFile({ fieldname: 'selfie' });
      kycService.verifyFace.mockRejectedValue(
        new BusinessRuleException('KYC_STEP_ORDER_VIOLATION', 'errors.kyc.stepOrderViolation', {
          requiredStep: 'document',
          currentStep: 'facial',
        }),
      );

      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ─── GET STATUS ─────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return KYC status from the service', async () => {
      const mockStatusResult = {
        status: KycStatus.IN_PROGRESS,
        completedSteps: ['cpf'],
        remainingSteps: ['document', 'facial', 'aml'],
        attemptCount: 1,
        canResubmit: false,
        rejectionReason: null,
      };

      kycService.getStatus.mockResolvedValue(mockStatusResult);

      const result = await controller.getStatus(mockUserId);

      expect(result).toEqual(mockStatusResult);
      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(result.completedSteps).toEqual(['cpf']);
      expect(result.remainingSteps).toContain('document');
    });

    it('should pass userId from @CurrentUser to the service', async () => {
      kycService.getStatus.mockResolvedValue({
        status: KycStatus.NOT_STARTED,
        completedSteps: [],
        remainingSteps: ['cpf', 'document', 'facial', 'aml'],
        attemptCount: 0,
        canResubmit: true,
        rejectionReason: null,
      });

      await controller.getStatus(mockUserId);

      expect(kycService.getStatus).toHaveBeenCalledTimes(1);
      expect(kycService.getStatus).toHaveBeenCalledWith(mockUserId);
    });

    it('should return NOT_STARTED status when user has no KYC record', async () => {
      const mockNotStarted = {
        status: KycStatus.NOT_STARTED,
        completedSteps: [],
        remainingSteps: ['cpf', 'document', 'facial', 'aml'],
        attemptCount: 0,
        canResubmit: true,
        rejectionReason: null,
      };

      kycService.getStatus.mockResolvedValue(mockNotStarted);

      const result = await controller.getStatus(mockUserId);

      expect(result.status).toBe(KycStatus.NOT_STARTED);
      expect(result.completedSteps).toHaveLength(0);
      expect(result.remainingSteps).toHaveLength(4);
      expect(result.canResubmit).toBe(true);
    });

    it('should return APPROVED status with all steps completed', async () => {
      const mockApproved = {
        status: KycStatus.APPROVED,
        completedSteps: ['cpf', 'document', 'facial', 'aml'],
        remainingSteps: [],
        attemptCount: 1,
        canResubmit: false,
        rejectionReason: null,
      };

      kycService.getStatus.mockResolvedValue(mockApproved);

      const result = await controller.getStatus(mockUserId);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(result.completedSteps).toHaveLength(4);
      expect(result.remainingSteps).toHaveLength(0);
      expect(result.canResubmit).toBe(false);
    });

    it('should return REJECTED status with rejection reason', async () => {
      const mockRejected = {
        status: KycStatus.REJECTED,
        completedSteps: ['cpf', 'document', 'facial', 'aml'],
        remainingSteps: [],
        attemptCount: 2,
        canResubmit: true,
        rejectionReason: 'Sanctions list match detected',
      };

      kycService.getStatus.mockResolvedValue(mockRejected);

      const result = await controller.getStatus(mockUserId);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(result.rejectionReason).toBe('Sanctions list match detected');
      expect(result.canResubmit).toBe(true);
    });

    it('should return canResubmit false when max attempts exceeded', async () => {
      const mockMaxAttempts = {
        status: KycStatus.REJECTED,
        completedSteps: ['cpf'],
        remainingSteps: ['document', 'facial', 'aml'],
        attemptCount: 3,
        canResubmit: false,
        rejectionReason: 'Document verification failed',
      };

      kycService.getStatus.mockResolvedValue(mockMaxAttempts);

      const result = await controller.getStatus(mockUserId);

      expect(result.canResubmit).toBe(false);
      expect(result.attemptCount).toBe(3);
    });
  });

  // ─── GENERAL ERROR PROPAGATION ──────────────────────────────────────────────

  describe('error propagation', () => {
    it('should propagate NotFoundException from service (no KYC record)', async () => {
      const notFoundError = new NotFoundException('kycVerification', mockUserId);
      kycService.startVerification.mockRejectedValue(notFoundError);

      await expect(controller.start(mockUserId)).rejects.toThrow(NotFoundException);
      await expect(controller.start(mockUserId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should propagate unexpected errors without swallowing them', async () => {
      const unexpectedError = new Error('Database connection lost');
      kycService.getStatus.mockRejectedValue(unexpectedError);

      await expect(controller.getStatus(mockUserId)).rejects.toThrow('Database connection lost');
    });

    it('should propagate BusinessRuleException for S3 unavailable', async () => {
      const selfieFile = createMockFile({ fieldname: 'selfie' });
      kycService.verifyFace.mockRejectedValue(
        new BusinessRuleException('KYC_S3_UNAVAILABLE', 'errors.kyc.s3Unavailable'),
      );

      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(controller.verifyFace(mockUserId, selfieFile)).rejects.toMatchObject({
        code: 'KYC_S3_UNAVAILABLE',
        statusCode: 422,
      });
    });

    it('should propagate BusinessRuleException for file too large', async () => {
      const frontFile = createMockFile();
      const files = { file: [frontFile] };
      const dto = { documentType: DocumentTypeDto.RG, documentNumber: '123' };

      kycService.uploadDocument.mockRejectedValue(
        new BusinessRuleException('KYC_FILE_TOO_LARGE', 'errors.kyc.fileTooLarge', {
          maxSizeBytes: 10485760,
          actualSizeBytes: 15000000,
        }),
      );

      await expect(
        controller.uploadDocument(mockUserId, files, dto),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        controller.uploadDocument(mockUserId, files, dto),
      ).rejects.toMatchObject({
        code: 'KYC_FILE_TOO_LARGE',
      });
    });

    it('should propagate BusinessRuleException for invalid file format', async () => {
      const frontFile = createMockFile();
      const files = { file: [frontFile] };
      const dto = { documentType: DocumentTypeDto.CNH, documentNumber: '456' };

      kycService.uploadDocument.mockRejectedValue(
        new BusinessRuleException('KYC_FILE_INVALID_FORMAT', 'errors.kyc.fileInvalidFormat', {
          reason: 'File must be a JPEG or PNG image',
        }),
      );

      await expect(
        controller.uploadDocument(mockUserId, files, dto),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
