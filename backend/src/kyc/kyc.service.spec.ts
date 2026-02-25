import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { KycStatus, DocumentType, Prisma } from '@prisma/client';
import { KycService } from './kyc.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerifikService } from './verifik/verifik.service';
import { EncryptionService } from '../encryption/encryption.service';
import { S3Service } from '../aws/s3.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

// ─── Test constants ─────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-001';
const KYC_ID = 'kyc-uuid-001';
const SESSION_ID = 'session-uuid-001';
const KYC_BUCKET = 'navia-kyc';
const VALID_CPF = '529.982.247-25'; // Valid Modulo 11
const ALL_SAME_CPF = '111.111.111-11';
const INVALID_CHECKSUM_CPF = '123.456.789-00';
const BLIND_INDEX = 'abcdef1234567890abcdef1234567890';
const ENCRYPTED_CPF_BUFFER = Buffer.from('encrypted-cpf-data');

// JPEG magic bytes (0xFF 0xD8 0xFF 0xE0)
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
// PNG magic bytes (0x89 0x50 0x4E 0x47)
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** Creates a valid JPEG buffer of the given size (defaults to 1 KB). */
function createJpegBuffer(sizeBytes = 1024): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  JPEG_MAGIC.copy(buf, 0);
  return buf;
}

/** Creates a valid PNG buffer of the given size (defaults to 1 KB). */
function createPngBuffer(sizeBytes = 1024): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  PNG_MAGIC.copy(buf, 0);
  return buf;
}

/** Creates a buffer with invalid magic bytes (not JPEG or PNG). */
function createInvalidBuffer(sizeBytes = 1024): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  buf[0] = 0x00;
  buf[1] = 0x01;
  buf[2] = 0x02;
  buf[3] = 0x03;
  return buf;
}

// ─── Mock factories ─────────────────────────────────────────────────────────

function createMockKyc(overrides: Record<string, unknown> = {}) {
  return {
    id: KYC_ID,
    userId: USER_ID,
    status: KycStatus.IN_PROGRESS,
    attemptCount: 1,
    verifikSessionId: SESSION_ID,
    cpfVerified: false,
    documentType: null,
    documentS3Key: null,
    faceVerified: false,
    faceMatchScore: null,
    livenessScore: null,
    selfieS3Key: null,
    amlScreeningDone: false,
    amlRiskScore: null,
    isPep: false,
    sanctionsMatch: false,
    submittedAt: new Date('2026-02-25T10:00:00Z'),
    verifiedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-02-25T10:00:00Z'),
    updatedAt: new Date('2026-02-25T10:00:00Z'),
    ...overrides,
  };
}

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    privyUserId: 'privy-1',
    email: 'joao@example.com',
    firstName: 'Joao',
    lastName: 'Silva',
    kycStatus: KycStatus.IN_PROGRESS,
    cpfEncrypted: null,
    cpfBlindIndex: null,
    walletAddress: null,
    locale: 'pt-BR',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createVerifyCpfDto(overrides: Record<string, unknown> = {}) {
  return {
    cpf: VALID_CPF,
    dateOfBirth: '15/05/1990',
    fullName: 'Joao Silva',
    ...overrides,
  };
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('KycService', () => {
  let service: KycService;
  let prisma: any;
  let verifikService: any;
  let encryptionService: any;
  let s3Service: any;
  let amlQueue: any;

  beforeEach(async () => {
    prisma = {
      kycVerification: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Default: $transaction passes through to the callback
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));

    verifikService = {
      verifyCpf: jest.fn(),
      verifyDocument: jest.fn(),
      matchFace: jest.fn(),
      screenAml: jest.fn(),
    };

    encryptionService = {
      createBlindIndex: jest.fn().mockReturnValue(BLIND_INDEX),
      isEncryptionAvailable: jest.fn().mockReturnValue(true),
      encrypt: jest.fn().mockResolvedValue(ENCRYPTED_CPF_BUFFER),
      decrypt: jest.fn().mockResolvedValue(VALID_CPF),
    };

    s3Service = {
      getKycBucket: jest.fn().mockReturnValue(KYC_BUCKET),
      upload: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
    };

    amlQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prisma },
        { provide: VerifikService, useValue: verifikService },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: S3Service, useValue: s3Service },
        { provide: getQueueToken('kyc-aml'), useValue: amlQueue },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. startVerification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('startVerification', () => {
    it('should create a new KYC record when no existing record', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);
      prisma.kycVerification.create.mockResolvedValue(
        createMockKyc({ attemptCount: 1 }),
      );
      prisma.user.update.mockResolvedValue(createMockUser());

      const result = await service.startVerification(USER_ID);

      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(result.requiredSteps).toEqual(['cpf', 'document', 'facial', 'aml']);
      expect(result.sessionId).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return existing session when already IN_PROGRESS', async () => {
      const existingKyc = createMockKyc({
        status: KycStatus.IN_PROGRESS,
        verifikSessionId: 'existing-session',
      });
      prisma.kycVerification.findUnique.mockResolvedValue(existingKyc);

      const result = await service.startVerification(USER_ID);

      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(result.requiredSteps).toEqual(['cpf', 'document', 'facial', 'aml']);
      // Should not create a new record or call $transaction
      expect(prisma.kycVerification.create).not.toHaveBeenCalled();
    });

    it('should reset and increment attempt when REJECTED', async () => {
      const rejectedKyc = createMockKyc({
        status: KycStatus.REJECTED,
        attemptCount: 1,
        cpfVerified: true,
        faceVerified: true,
        rejectionReason: 'Sanctions match',
      });
      prisma.kycVerification.findUnique.mockResolvedValue(rejectedKyc);
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ attemptCount: 2 }),
      );
      prisma.user.update.mockResolvedValue(createMockUser());

      const result = await service.startVerification(USER_ID);

      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify the update resets KYC fields
      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          data: expect.objectContaining({
            status: KycStatus.IN_PROGRESS,
            attemptCount: { increment: 1 },
            cpfVerified: false,
            faceVerified: false,
            amlScreeningDone: false,
            documentType: null,
            documentS3Key: null,
            rejectionReason: null,
          }),
        }),
      );
    });

    it('should reset and increment attempt when RESUBMISSION_REQUIRED', async () => {
      const resubKyc = createMockKyc({
        status: KycStatus.RESUBMISSION_REQUIRED,
        attemptCount: 2,
      });
      prisma.kycVerification.findUnique.mockResolvedValue(resubKyc);
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ attemptCount: 3 }),
      );
      prisma.user.update.mockResolvedValue(createMockUser());

      const result = await service.startVerification(USER_ID);

      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: KycStatus.IN_PROGRESS,
            attemptCount: { increment: 1 },
          }),
        }),
      );
    });

    it('should throw ConflictException when APPROVED', async () => {
      const approvedKyc = createMockKyc({ status: KycStatus.APPROVED });
      prisma.kycVerification.findUnique.mockResolvedValue(approvedKyc);

      await expect(service.startVerification(USER_ID)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.startVerification(USER_ID);
      } catch (e) {
        expect(e.code).toBe('KYC_ALREADY_APPROVED');
        expect(e.messageKey).toBe('errors.kyc.alreadyApproved');
      }
    });

    it('should throw ConflictException when PENDING_REVIEW', async () => {
      const pendingKyc = createMockKyc({ status: KycStatus.PENDING_REVIEW });
      prisma.kycVerification.findUnique.mockResolvedValue(pendingKyc);

      await expect(service.startVerification(USER_ID)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.startVerification(USER_ID);
      } catch (e) {
        expect(e.code).toBe('KYC_UNDER_REVIEW');
        expect(e.messageKey).toBe('errors.kyc.underReview');
      }
    });

    it('should throw BusinessRuleException when MAX_ATTEMPTS exceeded', async () => {
      const maxedKyc = createMockKyc({
        status: KycStatus.REJECTED,
        attemptCount: 3,
      });
      prisma.kycVerification.findUnique.mockResolvedValue(maxedKyc);

      await expect(service.startVerification(USER_ID)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.startVerification(USER_ID);
      } catch (e) {
        expect(e.code).toBe('KYC_MAX_ATTEMPTS_EXCEEDED');
        expect(e.details).toEqual({ maxAttempts: 3, currentAttempts: 3 });
      }
    });

    it('should throw BusinessRuleException when attemptCount exceeds max even for IN_PROGRESS status', async () => {
      // Edge case: attemptCount >= MAX_ATTEMPTS is checked before status check
      const maxedKyc = createMockKyc({
        status: KycStatus.IN_PROGRESS,
        attemptCount: 5,
      });
      prisma.kycVerification.findUnique.mockResolvedValue(maxedKyc);

      // Should not throw since the attemptCount check happens only when status
      // allows restart — IN_PROGRESS is returned directly. However, looking
      // at the code, attemptCount >= MAX_ATTEMPTS is checked before status
      // branching, so it WILL throw.
      await expect(service.startVerification(USER_ID)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. verifyCpf
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyCpf', () => {
    const verifikCpfResponse = {
      data: {
        fullName: 'Joao Silva',
        dateOfBirth: '15/05/1990',
        cpfStatus: 'REGULAR',
      },
      signature: 'verifik-sig-123',
    };

    it('should successfully verify CPF with valid checksum', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      prisma.user.findFirst.mockResolvedValue(null); // No duplicate
      verifikService.verifyCpf.mockResolvedValue(verifikCpfResponse);
      prisma.user.update.mockResolvedValue(createMockUser());
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true }),
      );

      const dto = createVerifyCpfDto();
      const result = await service.verifyCpf(USER_ID, dto);

      expect(result.verified).toBe(true);
      expect(result.cpfData).toEqual(verifikCpfResponse.data);
      expect(result.verifikSignature).toBe('verifik-sig-123');
      expect(verifikService.verifyCpf).toHaveBeenCalledWith(
        VALID_CPF,
        '15/05/1990',
      );
    });

    it('should throw NotFoundException when no KYC record exists', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyCpf(USER_ID, createVerifyCpfDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException when KYC not IN_PROGRESS', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({ status: KycStatus.APPROVED }),
      );

      await expect(
        service.verifyCpf(USER_ID, createVerifyCpfDto()),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.verifyCpf(USER_ID, createVerifyCpfDto());
      } catch (e) {
        expect(e.code).toBe('KYC_INVALID_STATUS');
      }
    });

    it('should throw BusinessRuleException for invalid CPF checksum', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());

      const dto = createVerifyCpfDto({ cpf: INVALID_CHECKSUM_CPF });

      await expect(service.verifyCpf(USER_ID, dto)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyCpf(USER_ID, dto);
      } catch (e) {
        expect(e.code).toBe('KYC_CPF_INVALID');
        expect(e.messageKey).toBe('errors.kyc.cpfInvalid');
      }
    });

    it('should throw BusinessRuleException for all-same-digit CPFs', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());

      const dto = createVerifyCpfDto({ cpf: ALL_SAME_CPF });

      await expect(service.verifyCpf(USER_ID, dto)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyCpf(USER_ID, dto);
      } catch (e) {
        expect(e.code).toBe('KYC_CPF_INVALID');
      }
    });

    it('should throw BusinessRuleException when CPF belongs to another user', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      // Another user with the same CPF blind index
      prisma.user.findFirst.mockResolvedValue(
        createMockUser({ id: 'other-user-uuid' }),
      );

      const dto = createVerifyCpfDto();

      await expect(service.verifyCpf(USER_ID, dto)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyCpf(USER_ID, dto);
      } catch (e) {
        expect(e.code).toBe('KYC_CPF_DUPLICATE');
        expect(e.messageKey).toBe('errors.kyc.cpfDuplicate');
      }
    });

    it('should check CPF uniqueness with blind index excluding current user', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      prisma.user.findFirst.mockResolvedValue(null);
      verifikService.verifyCpf.mockResolvedValue(verifikCpfResponse);
      prisma.user.update.mockResolvedValue(createMockUser());
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true }),
      );

      await service.verifyCpf(USER_ID, createVerifyCpfDto());

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          cpfBlindIndex: BLIND_INDEX,
          id: { not: USER_ID },
        },
      });
    });

    it('should encrypt CPF and store blind index on User', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      prisma.user.findFirst.mockResolvedValue(null);
      verifikService.verifyCpf.mockResolvedValue(verifikCpfResponse);
      prisma.user.update.mockResolvedValue(createMockUser());
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true }),
      );

      await service.verifyCpf(USER_ID, createVerifyCpfDto());

      expect(encryptionService.createBlindIndex).toHaveBeenCalledWith(VALID_CPF);
      expect(encryptionService.isEncryptionAvailable).toHaveBeenCalled();
      expect(encryptionService.encrypt).toHaveBeenCalledWith(VALID_CPF);

      // Verify the user update within the transaction
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          cpfEncrypted: ENCRYPTED_CPF_BUFFER,
          cpfBlindIndex: BLIND_INDEX,
        },
      });
    });

    it('should handle KMS unavailable gracefully (still stores blind index)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      prisma.user.findFirst.mockResolvedValue(null);
      verifikService.verifyCpf.mockResolvedValue(verifikCpfResponse);
      encryptionService.isEncryptionAvailable.mockReturnValue(false);
      prisma.user.update.mockResolvedValue(createMockUser());
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true }),
      );

      const result = await service.verifyCpf(USER_ID, createVerifyCpfDto());

      expect(result.verified).toBe(true);
      expect(encryptionService.encrypt).not.toHaveBeenCalled();

      // Should still store the blind index, but cpfEncrypted is null
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          cpfEncrypted: null,
          cpfBlindIndex: BLIND_INDEX,
        },
      });
    });

    it('should update kycVerification.cpfVerified to true', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(createMockKyc());
      prisma.user.findFirst.mockResolvedValue(null);
      verifikService.verifyCpf.mockResolvedValue(verifikCpfResponse);
      prisma.user.update.mockResolvedValue(createMockUser());
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true }),
      );

      await service.verifyCpf(USER_ID, createVerifyCpfDto());

      expect(prisma.kycVerification.update).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { cpfVerified: true },
      });
    });

    it('should throw when PENDING_REVIEW status is used', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({ status: KycStatus.PENDING_REVIEW }),
      );

      await expect(
        service.verifyCpf(USER_ID, createVerifyCpfDto()),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. uploadDocument
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadDocument', () => {
    const verifikDocResponse = {
      data: {
        fullName: 'Joao Silva',
        documentNumber: '12345678',
        issueDate: '01/01/2020',
        expiryDate: '01/01/2030',
      },
      verified: true,
      authenticity: 95,
    };

    const cpfVerifiedKyc = createMockKyc({ cpfVerified: true });
    const validJpeg = createJpegBuffer();

    beforeEach(() => {
      prisma.kycVerification.findUnique.mockResolvedValue(cpfVerifiedKyc);
      verifikService.verifyDocument.mockResolvedValue(verifikDocResponse);
      prisma.user.findUniqueOrThrow.mockResolvedValue(
        createMockUser({ firstName: 'Joao', lastName: 'Silva' }),
      );
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ cpfVerified: true, documentType: 'RG' }),
      );
    });

    it('should successfully upload and verify document', async () => {
      const result = await service.uploadDocument(
        USER_ID,
        'RG',
        '12345678',
        validJpeg,
      );

      expect(result.verified).toBe(true);
      expect(result.extractedData).toEqual(verifikDocResponse.data);
      expect(s3Service.upload).toHaveBeenCalledWith(
        KYC_BUCKET,
        expect.stringContaining(`kyc/${USER_ID}/RG-front-`),
        validJpeg,
        expect.objectContaining({
          contentType: 'image/jpeg',
          serverSideEncryption: 'aws:kms',
        }),
      );
      expect(verifikService.verifyDocument).toHaveBeenCalledWith(
        validJpeg,
        'RG',
      );
    });

    it('should throw BusinessRuleException when CPF not verified (step order)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({ cpfVerified: false }),
      );

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg);
      } catch (e) {
        expect(e.code).toBe('KYC_STEP_ORDER_VIOLATION');
        expect(e.details).toEqual({
          requiredStep: 'cpf',
          currentStep: 'document',
        });
      }
    });

    it('should throw BusinessRuleException when status not IN_PROGRESS', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({ status: KycStatus.APPROVED, cpfVerified: true }),
      );

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg);
      } catch (e) {
        expect(e.code).toBe('KYC_INVALID_STATUS');
      }
    });

    it('should throw BusinessRuleException for oversized files (>10MB)', async () => {
      const oversizedBuffer = createJpegBuffer(11 * 1024 * 1024);

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', oversizedBuffer),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', oversizedBuffer);
      } catch (e) {
        expect(e.code).toBe('KYC_FILE_TOO_LARGE');
      }
    });

    it('should throw BusinessRuleException for invalid file format (not JPEG/PNG)', async () => {
      const invalidBuffer = createInvalidBuffer();

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', invalidBuffer),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', invalidBuffer);
      } catch (e) {
        expect(e.code).toBe('KYC_FILE_INVALID_FORMAT');
      }
    });

    it('should throw BusinessRuleException when S3 KYC bucket not configured', async () => {
      s3Service.getKycBucket.mockReturnValue(null);

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg);
      } catch (e) {
        expect(e.code).toBe('KYC_S3_UNAVAILABLE');
      }
    });

    it('should throw BusinessRuleException for expired documents', async () => {
      verifikService.verifyDocument.mockResolvedValue({
        ...verifikDocResponse,
        data: {
          ...verifikDocResponse.data,
          expiryDate: '01/01/2020', // Expired date in the past
        },
      });

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg);
      } catch (e) {
        expect(e.code).toBe('KYC_DOCUMENT_EXPIRED');
        expect(e.details).toEqual({ expiryDate: '01/01/2020' });
      }
    });

    it('should upload both front and back images', async () => {
      const frontJpeg = createJpegBuffer();
      const backPng = createPngBuffer();

      await service.uploadDocument(
        USER_ID,
        'RG',
        '12345678',
        frontJpeg,
        backPng,
      );

      // Should have uploaded twice (front + back)
      expect(s3Service.upload).toHaveBeenCalledTimes(2);
      expect(s3Service.upload).toHaveBeenCalledWith(
        KYC_BUCKET,
        expect.stringContaining('RG-front-'),
        frontJpeg,
        expect.any(Object),
      );
      expect(s3Service.upload).toHaveBeenCalledWith(
        KYC_BUCKET,
        expect.stringContaining('RG-back-'),
        backPng,
        expect.objectContaining({
          contentType: 'image/png',
          serverSideEncryption: 'aws:kms',
        }),
      );

      // S3 key should be composite (front|back)
      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentS3Key: expect.stringContaining('|'),
          }),
        }),
      );
    });

    it('should map PASSPORT to RNE document type', async () => {
      await service.uploadDocument(
        USER_ID,
        'PASSPORT',
        'AB123456',
        validJpeg,
      );

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: DocumentType.RNE,
          }),
        }),
      );
    });

    it('should throw NotFoundException when no KYC record exists', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg),
      ).rejects.toThrow(NotFoundException);
    });

    it('should store RG document type correctly', async () => {
      await service.uploadDocument(USER_ID, 'RG', '12345678', validJpeg);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: DocumentType.RG,
          }),
        }),
      );
    });

    it('should store CNH document type correctly', async () => {
      await service.uploadDocument(USER_ID, 'CNH', '12345678', validJpeg);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: DocumentType.CNH,
          }),
        }),
      );
    });

    it('should not reject when expiryDate is null (no expiry)', async () => {
      verifikService.verifyDocument.mockResolvedValue({
        ...verifikDocResponse,
        data: {
          ...verifikDocResponse.data,
          expiryDate: null,
        },
      });

      const result = await service.uploadDocument(
        USER_ID,
        'RG',
        '12345678',
        validJpeg,
      );

      expect(result.verified).toBe(true);
    });

    it('should throw for very small files (less than 4 bytes)', async () => {
      const tinyBuffer = Buffer.from([0xff, 0xd8]);

      await expect(
        service.uploadDocument(USER_ID, 'RG', '12345678', tinyBuffer),
      ).rejects.toThrow(BusinessRuleException);

      try {
        await service.uploadDocument(USER_ID, 'RG', '12345678', tinyBuffer);
      } catch (e) {
        expect(e.code).toBe('KYC_FILE_INVALID_FORMAT');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. verifyFace
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyFace', () => {
    const faceReadyKyc = createMockKyc({
      cpfVerified: true,
      documentS3Key: 'kyc/user-uuid-001/RG-front-abc123',
    });
    const validSelfie = createJpegBuffer();

    beforeEach(() => {
      prisma.kycVerification.findUnique.mockResolvedValue(faceReadyKyc);
      verifikService.matchFace.mockResolvedValue({
        matchScore: 92,
        livenessScore: 95,
      });
      prisma.kycVerification.update.mockResolvedValue(
        createMockKyc({ faceVerified: true, status: KycStatus.PENDING_REVIEW }),
      );
      prisma.user.update.mockResolvedValue(
        createMockUser({ kycStatus: KycStatus.PENDING_REVIEW }),
      );
    });

    it('should successfully verify face and queue AML', async () => {
      const result = await service.verifyFace(USER_ID, validSelfie);

      expect(result.verified).toBe(true);
      expect(result.faceMatchScore).toBe(92);
      expect(result.livenessScore).toBe(95);

      // Should upload selfie to S3
      expect(s3Service.upload).toHaveBeenCalledWith(
        KYC_BUCKET,
        expect.stringContaining(`kyc/${USER_ID}/selfie-`),
        validSelfie,
        expect.objectContaining({ serverSideEncryption: 'aws:kms' }),
      );

      // Should generate presigned URL for document image
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        KYC_BUCKET,
        'kyc/user-uuid-001/RG-front-abc123',
        900,
      );

      // Should queue AML screening
      expect(amlQueue.add).toHaveBeenCalledWith(
        'screen-aml',
        { kycVerificationId: KYC_ID },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });

    it('should throw BusinessRuleException when CPF not verified (step order)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          cpfVerified: false,
          documentS3Key: 'kyc/user-uuid-001/RG-front-abc123',
        }),
      );

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyFace(USER_ID, validSelfie);
      } catch (e) {
        expect(e.code).toBe('KYC_STEP_ORDER_VIOLATION');
        expect(e.details).toEqual({
          requiredStep: 'cpf',
          currentStep: 'facial',
        });
      }
    });

    it('should throw BusinessRuleException when document not uploaded (step order)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          cpfVerified: true,
          documentS3Key: null,
        }),
      );

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyFace(USER_ID, validSelfie);
      } catch (e) {
        expect(e.code).toBe('KYC_STEP_ORDER_VIOLATION');
        expect(e.details).toEqual({
          requiredStep: 'document',
          currentStep: 'facial',
        });
      }
    });

    it('should throw BusinessRuleException for low liveness score', async () => {
      verifikService.matchFace.mockResolvedValue({
        matchScore: 92,
        livenessScore: 70, // Below service threshold of 80
      });

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyFace(USER_ID, validSelfie);
      } catch (e) {
        expect(e.code).toBe('KYC_LIVENESS_CHECK_FAILED');
        expect(e.details).toEqual({
          livenessScore: 70,
          threshold: 80,
        });
      }
    });

    it('should throw BusinessRuleException for low face match score', async () => {
      verifikService.matchFace.mockResolvedValue({
        matchScore: 80, // Below service threshold of 85
        livenessScore: 95,
      });

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyFace(USER_ID, validSelfie);
      } catch (e) {
        expect(e.code).toBe('KYC_FACE_MATCH_FAILED');
        expect(e.details).toEqual({
          faceMatchScore: 80,
          threshold: 85,
        });
      }
    });

    it('should throw BusinessRuleException when S3 KYC bucket not configured', async () => {
      s3Service.getKycBucket.mockReturnValue(null);

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.verifyFace(USER_ID, validSelfie);
      } catch (e) {
        expect(e.code).toBe('KYC_S3_UNAVAILABLE');
      }
    });

    it('should transition status to PENDING_REVIEW', async () => {
      await service.verifyFace(USER_ID, validSelfie);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            faceVerified: true,
            status: KycStatus.PENDING_REVIEW,
            selfieS3Key: expect.stringContaining(`kyc/${USER_ID}/selfie-`),
          }),
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { kycStatus: KycStatus.PENDING_REVIEW },
      });
    });

    it('should queue AML screening job with correct options', async () => {
      await service.verifyFace(USER_ID, validSelfie);

      expect(amlQueue.add).toHaveBeenCalledWith(
        'screen-aml',
        { kycVerificationId: KYC_ID },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
    });

    it('should throw NotFoundException when no KYC record', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);

      await expect(service.verifyFace(USER_ID, validSelfie)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException for invalid selfie format', async () => {
      const invalidSelfie = createInvalidBuffer();

      await expect(
        service.verifyFace(USER_ID, invalidSelfie),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should use front key from composite S3 key when document has front|back', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          cpfVerified: true,
          documentS3Key: 'kyc/user-uuid-001/RG-front-abc|kyc/user-uuid-001/RG-back-def',
        }),
      );

      await service.verifyFace(USER_ID, validSelfie);

      // Should only use the front key for presigned URL
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        KYC_BUCKET,
        'kyc/user-uuid-001/RG-front-abc',
        900,
      );
    });

    it('should store face match and liveness scores as Prisma Decimals', async () => {
      await service.verifyFace(USER_ID, validSelfie);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            faceMatchScore: new Prisma.Decimal(92),
            livenessScore: new Prisma.Decimal(95),
          }),
        }),
      );
    });

    it('should accept PNG selfie images', async () => {
      const pngSelfie = createPngBuffer();

      const result = await service.verifyFace(USER_ID, pngSelfie);

      expect(result.verified).toBe(true);
      expect(s3Service.upload).toHaveBeenCalledWith(
        KYC_BUCKET,
        expect.any(String),
        pngSelfie,
        expect.objectContaining({ contentType: 'image/png' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. getStatus
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStatus', () => {
    it('should return NOT_STARTED when no KYC record', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);

      const result = await service.getStatus(USER_ID);

      expect(result).toEqual({
        status: KycStatus.NOT_STARTED,
        completedSteps: [],
        remainingSteps: ['cpf', 'document', 'facial', 'aml'],
        attemptCount: 0,
        canResubmit: true,
        rejectionReason: null,
      });
    });

    it('should return correct completed/remaining steps for IN_PROGRESS (cpf done)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.IN_PROGRESS,
          cpfVerified: true,
          documentS3Key: null,
          faceVerified: false,
          amlScreeningDone: false,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.status).toBe(KycStatus.IN_PROGRESS);
      expect(result.completedSteps).toEqual(['cpf']);
      expect(result.remainingSteps).toEqual(['document', 'facial', 'aml']);
    });

    it('should return correct steps when cpf and document are done', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.IN_PROGRESS,
          cpfVerified: true,
          documentS3Key: 'kyc/user/doc-key',
          faceVerified: false,
          amlScreeningDone: false,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.completedSteps).toEqual(['cpf', 'document']);
      expect(result.remainingSteps).toEqual(['facial', 'aml']);
    });

    it('should return all steps completed for APPROVED KYC', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.APPROVED,
          cpfVerified: true,
          documentS3Key: 'kyc/user/doc-key',
          faceVerified: true,
          amlScreeningDone: true,
          attemptCount: 1,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(result.completedSteps).toEqual(['cpf', 'document', 'facial', 'aml']);
      expect(result.remainingSteps).toEqual([]);
      expect(result.canResubmit).toBe(false);
    });

    it('should return canResubmit=true when attempts < max and REJECTED', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.REJECTED,
          attemptCount: 2,
          rejectionReason: 'Sanctions list match',
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.canResubmit).toBe(true);
      expect(result.rejectionReason).toBe('Sanctions list match');
    });

    it('should return canResubmit=false when attempts >= max', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.REJECTED,
          attemptCount: 3,
          rejectionReason: 'Maximum attempts reached',
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.canResubmit).toBe(false);
    });

    it('should return canResubmit=false for PENDING_REVIEW status', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.PENDING_REVIEW,
          attemptCount: 1,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.canResubmit).toBe(false);
    });

    it('should return canResubmit=false for IN_PROGRESS status', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.IN_PROGRESS,
          attemptCount: 1,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.canResubmit).toBe(false);
    });

    it('should return canResubmit=true for RESUBMISSION_REQUIRED with attempts < max', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(
        createMockKyc({
          status: KycStatus.RESUBMISSION_REQUIRED,
          attemptCount: 1,
        }),
      );

      const result = await service.getStatus(USER_ID);

      expect(result.canResubmit).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. processAmlScreening
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processAmlScreening', () => {
    const mockUser = createMockUser({
      cpfEncrypted: Buffer.from('encrypted'),
      firstName: 'Joao',
      lastName: 'Silva',
    });

    const mockKycWithUser = {
      ...createMockKyc({ status: KycStatus.PENDING_REVIEW }),
      user: mockUser,
    };

    beforeEach(() => {
      prisma.kycVerification.findUnique.mockResolvedValue(mockKycWithUser);
      prisma.kycVerification.update.mockResolvedValue(createMockKyc());
      prisma.user.update.mockResolvedValue(createMockUser());
    });

    it('should approve when no sanctions, low risk, not PEP', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: KYC_ID },
          data: expect.objectContaining({
            amlScreeningDone: true,
            amlRiskScore: new Prisma.Decimal(10), // LOW = 10
            isPep: false,
            sanctionsMatch: false,
            status: KycStatus.APPROVED,
            verifiedAt: expect.any(Date),
          }),
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { kycStatus: KycStatus.APPROVED },
      });
    });

    it('should reject when sanctions match found', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'HIGH',
        isPEP: false,
        sanctionsMatch: true,
        details: { list: 'OFAC' },
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: KycStatus.REJECTED,
            sanctionsMatch: true,
            rejectedAt: expect.any(Date),
            rejectionReason: 'Sanctions list match detected',
          }),
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { kycStatus: KycStatus.REJECTED },
      });
    });

    it('should keep PENDING_REVIEW for HIGH risk', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'HIGH',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: KycStatus.PENDING_REVIEW,
            amlRiskScore: new Prisma.Decimal(90), // HIGH = 90
          }),
        }),
      );
    });

    it('should keep PENDING_REVIEW for PEP', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: true,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: KycStatus.PENDING_REVIEW,
            isPep: true,
          }),
        }),
      );
    });

    it('should handle missing KYC record gracefully (returns, does not throw)', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue(null);

      // Should not throw
      await expect(
        service.processAmlScreening('nonexistent-kyc-id'),
      ).resolves.toBeUndefined();

      expect(verifikService.screenAml).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle missing user on KYC record gracefully', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue({
        ...createMockKyc({ status: KycStatus.PENDING_REVIEW }),
        user: null,
      });

      await expect(
        service.processAmlScreening(KYC_ID),
      ).resolves.toBeUndefined();

      expect(verifikService.screenAml).not.toHaveBeenCalled();
    });

    it('should set verifiedAt for APPROVED', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      const updateCall = prisma.kycVerification.update.mock.calls[0][0];
      expect(updateCall.data.verifiedAt).toBeInstanceOf(Date);
    });

    it('should set rejectedAt and rejectionReason for REJECTED', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'HIGH',
        isPEP: false,
        sanctionsMatch: true,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      const updateCall = prisma.kycVerification.update.mock.calls[0][0];
      expect(updateCall.data.rejectedAt).toBeInstanceOf(Date);
      expect(updateCall.data.rejectionReason).toBe(
        'Sanctions list match detected',
      );
    });

    it('should not set verifiedAt or rejectedAt for PENDING_REVIEW', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'HIGH',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      const updateCall = prisma.kycVerification.update.mock.calls[0][0];
      expect(updateCall.data.verifiedAt).toBeUndefined();
      expect(updateCall.data.rejectedAt).toBeUndefined();
    });

    it('should decrypt CPF for AML screening when available', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(encryptionService.decrypt).toHaveBeenCalledWith(
        expect.any(Buffer),
      );
      expect(verifikService.screenAml).toHaveBeenCalledWith(
        'Joao Silva',
        VALID_CPF,
        'BR',
      );
    });

    it('should proceed with empty CPF string when decryption fails', async () => {
      encryptionService.decrypt.mockRejectedValue(
        new Error('KMS unavailable'),
      );

      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      // Should still call screenAml with empty string for CPF
      expect(verifikService.screenAml).toHaveBeenCalledWith(
        'Joao Silva',
        '',
        'BR',
      );
    });

    it('should proceed with empty CPF string when cpfEncrypted is null', async () => {
      prisma.kycVerification.findUnique.mockResolvedValue({
        ...createMockKyc({ status: KycStatus.PENDING_REVIEW }),
        user: createMockUser({ cpfEncrypted: null }),
      });

      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(encryptionService.decrypt).not.toHaveBeenCalled();
      expect(verifikService.screenAml).toHaveBeenCalledWith(
        expect.any(String),
        '',
        'BR',
      );
    });

    it('should map MEDIUM risk score to numeric 50', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'MEDIUM',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amlRiskScore: new Prisma.Decimal(50),
            status: KycStatus.APPROVED, // MEDIUM without PEP/sanctions = APPROVED
          }),
        }),
      );
    });

    it('should query KYC verification with user included', async () => {
      verifikService.screenAml.mockResolvedValue({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.processAmlScreening(KYC_ID);

      expect(prisma.kycVerification.findUnique).toHaveBeenCalledWith({
        where: { id: KYC_ID },
        include: { user: true },
      });
    });
  });
});
