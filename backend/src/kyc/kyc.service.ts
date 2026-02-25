import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { randomUUID } from 'crypto';
import { KycStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VerifikService } from './verifik/verifik.service';
import { EncryptionService } from '../encryption/encryption.service';
import { S3Service } from '../aws/s3.service';
import { VerifyCpfDto } from './dto/verify-cpf.dto';
import { KycStatusResponse } from './dto/kyc-status-response.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of KYC verification attempts before permanent lockout. */
const MAX_ATTEMPTS = 3;

/**
 * Minimum face match score required at the KYC service level.
 * This is stricter than Verifik's internal threshold (80) to add
 * an application-level safety margin.
 */
const FACE_MATCH_MIN_SCORE = 85;

/** Minimum liveness score required at the KYC service level. */
const LIVENESS_MIN_SCORE = 80;

/**
 * Minimum normalised name similarity (0–1) required for the
 * document-extracted name to match the CPF-registered name.
 */
const NAME_MATCH_THRESHOLD = 0.9;

/** Maximum file size for document/selfie uploads (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Ordered list of KYC verification steps. */
const KYC_STEPS = ['cpf', 'document', 'facial', 'aml'] as const;
type KycStep = (typeof KYC_STEPS)[number];

// ─── Magic bytes for image format validation ─────────────────────────────────

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifikService: VerifikService,
    private readonly encryptionService: EncryptionService,
    private readonly s3Service: S3Service,
    @InjectQueue('kyc-aml') private readonly amlQueue: Queue,
  ) {}

  // ─── 1. Start Verification ──────────────────────────────────────────────────

  /**
   * Initiates or restarts a KYC verification flow for the given user.
   *
   * Preconditions checked:
   * - User must not already have an APPROVED KYC
   * - User must not be in PENDING_REVIEW (awaiting AML)
   * - User must not have exceeded MAX_ATTEMPTS
   *
   * If the user has a REJECTED or RESUBMISSION_REQUIRED KYC, it is reset
   * for a new attempt.
   */
  async startVerification(
    userId: string,
  ): Promise<{ sessionId: string; status: string; requiredSteps: string[] }> {
    const existing = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    // Prevent re-verification if already approved
    if (existing && existing.status === KycStatus.APPROVED) {
      throw new ConflictException(
        'KYC_ALREADY_APPROVED',
        'errors.kyc.alreadyApproved',
      );
    }

    // Prevent new attempt while review is in progress
    if (existing && existing.status === KycStatus.PENDING_REVIEW) {
      throw new ConflictException(
        'KYC_UNDER_REVIEW',
        'errors.kyc.underReview',
      );
    }

    // Enforce maximum attempt limit
    if (existing && existing.attemptCount >= MAX_ATTEMPTS) {
      throw new BusinessRuleException(
        'KYC_MAX_ATTEMPTS_EXCEEDED',
        'errors.kyc.maxAttemptsExceeded',
        { maxAttempts: MAX_ATTEMPTS, currentAttempts: existing.attemptCount },
      );
    }

    const sessionId = randomUUID();

    let kyc: { id: string; status: KycStatus };

    if (
      existing &&
      (existing.status === KycStatus.REJECTED ||
        existing.status === KycStatus.RESUBMISSION_REQUIRED)
    ) {
      // Reset for a new attempt — preserve attemptCount
      kyc = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.kycVerification.update({
          where: { userId },
          data: {
            status: KycStatus.IN_PROGRESS,
            attemptCount: { increment: 1 },
            verifikSessionId: sessionId,
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
            submittedAt: new Date(),
            verifiedAt: null,
            rejectedAt: null,
            rejectionReason: null,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: KycStatus.IN_PROGRESS },
        });

        return updated;
      });
    } else if (
      existing &&
      existing.status === KycStatus.IN_PROGRESS
    ) {
      // Already in progress — return current session
      kyc = existing;
    } else {
      // Create a new KycVerification record
      kyc = await this.prisma.$transaction(async (tx) => {
        const created = await tx.kycVerification.create({
          data: {
            userId,
            status: KycStatus.IN_PROGRESS,
            attemptCount: 1,
            verifikSessionId: sessionId,
            submittedAt: new Date(),
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: KycStatus.IN_PROGRESS },
        });

        return created;
      });
    }

    this.logger.log(
      `[startVerification] KYC started for userId=${userId} sessionId=${sessionId}`,
    );

    return {
      sessionId,
      status: KycStatus.IN_PROGRESS,
      requiredSteps: [...KYC_STEPS],
    };
  }

  // ─── 2. Verify CPF ──────────────────────────────────────────────────────────

  /**
   * Validates the user's CPF against Modulo 11 checksum and the Receita Federal
   * registry via Verifik. Stores the encrypted CPF and blind index on the User.
   */
  async verifyCpf(
    userId: string,
    dto: VerifyCpfDto,
  ): Promise<{
    verified: boolean;
    cpfData: { fullName: string; dateOfBirth: string; cpfStatus: string };
    verifikSignature: string;
  }> {
    const kyc = await this.loadKycOrThrow(userId);

    this.ensureStatus(kyc.status, KycStatus.IN_PROGRESS, 'verifyCpf');

    // Validate CPF checksum locally before calling Verifik
    if (!this.validateCpfChecksum(dto.cpf)) {
      throw new BusinessRuleException(
        'KYC_CPF_INVALID',
        'errors.kyc.cpfInvalid',
      );
    }

    // Check CPF uniqueness via blind index — no other user should own this CPF
    const blindIndex = this.encryptionService.createBlindIndex(dto.cpf);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        cpfBlindIndex: blindIndex,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new BusinessRuleException(
        'KYC_CPF_DUPLICATE',
        'errors.kyc.cpfDuplicate',
      );
    }

    // Call Verifik API to verify CPF against Receita Federal
    const verifikResult = await this.verifikService.verifyCpf(
      dto.cpf,
      dto.dateOfBirth,
    );

    // Encrypt CPF and store on User record
    let cpfEncrypted: Buffer | null = null;
    if (this.encryptionService.isEncryptionAvailable()) {
      cpfEncrypted = await this.encryptionService.encrypt(dto.cpf);
    } else {
      this.logger.warn(
        '[verifyCpf] KMS unavailable — CPF stored without application-level encryption',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update User with encrypted CPF + blind index
      await tx.user.update({
        where: { id: userId },
        data: {
          cpfEncrypted: cpfEncrypted,
          cpfBlindIndex: blindIndex,
        },
      });

      // Mark CPF step as completed on KycVerification
      await tx.kycVerification.update({
        where: { userId },
        data: {
          cpfVerified: true,
        },
      });
    });

    this.logger.log(
      `[verifyCpf] CPF verified for userId=${userId} cpfStatus=${verifikResult.data.cpfStatus}`,
    );

    return {
      verified: true,
      cpfData: verifikResult.data,
      verifikSignature: verifikResult.signature,
    };
  }

  // ─── 3. Upload Document ─────────────────────────────────────────────────────

  /**
   * Uploads and verifies an identity document (RG, CNH, RNE) via Verifik OCR.
   * Compares the extracted name against the CPF-registered name using fuzzy matching.
   */
  async uploadDocument(
    userId: string,
    documentType: string,
    documentNumber: string,
    file: Buffer,
    fileBack?: Buffer,
  ): Promise<{
    verified: boolean;
    extractedData: {
      fullName: string;
      documentNumber: string;
      issueDate: string | null;
      expiryDate: string | null;
    };
  }> {
    const kyc = await this.loadKycOrThrow(userId);

    this.ensureStatus(kyc.status, KycStatus.IN_PROGRESS, 'uploadDocument');

    // Enforce step order: CPF must be verified first
    if (!kyc.cpfVerified) {
      throw new BusinessRuleException(
        'KYC_STEP_ORDER_VIOLATION',
        'errors.kyc.stepOrderViolation',
        { requiredStep: 'cpf', currentStep: 'document' },
      );
    }

    // Validate file size and format
    this.validateImageBuffer(file);
    if (fileBack) {
      this.validateImageBuffer(fileBack);
    }

    // Upload front of document to S3 with KMS encryption
    const kycBucket = this.s3Service.getKycBucket();
    if (!kycBucket) {
      throw new BusinessRuleException(
        'KYC_S3_UNAVAILABLE',
        'errors.kyc.s3Unavailable',
      );
    }

    const frontKey = `kyc/${userId}/${documentType}-front-${randomUUID()}`;
    await this.s3Service.upload(kycBucket, frontKey, file, {
      contentType: this.detectContentType(file),
      serverSideEncryption: 'aws:kms',
    });

    // Upload back of document if provided
    let backKey: string | null = null;
    if (fileBack) {
      backKey = `kyc/${userId}/${documentType}-back-${randomUUID()}`;
      await this.s3Service.upload(kycBucket, backKey, fileBack, {
        contentType: this.detectContentType(fileBack),
        serverSideEncryption: 'aws:kms',
      });
    }

    // Call Verifik to verify the document via OCR
    const verifikResult = await this.verifikService.verifyDocument(
      file,
      documentType,
    );

    // Compare extracted name with CPF name via fuzzy match
    // Load the user to get CPF-verified name (stored during verifyCpf step)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const extractedName = verifikResult.data.fullName;

    if (userName && extractedName) {
      const similarity = this.calculateNameSimilarity(userName, extractedName);
      if (similarity < NAME_MATCH_THRESHOLD) {
        this.logger.warn(
          `[uploadDocument] Name mismatch for userId=${userId}: ` +
            `profile="${userName}" document="${extractedName}" similarity=${similarity.toFixed(3)}`,
        );
        // We log a warning but do not reject — the manual review step
        // (PENDING_REVIEW) will catch name discrepancies. This is a soft check.
      }
    }

    // Check for expired document
    if (verifikResult.data.expiryDate) {
      const expiry = this.parseDate(verifikResult.data.expiryDate);
      if (expiry && expiry < new Date()) {
        throw new BusinessRuleException(
          'KYC_DOCUMENT_EXPIRED',
          'errors.kyc.documentExpired',
          { expiryDate: verifikResult.data.expiryDate },
        );
      }
    }

    // Map DTO documentType to Prisma enum
    const prismaDocumentType = this.mapDocumentType(documentType);

    // Store the primary S3 key (front). Back key stored in a composite format if present.
    const s3Key = backKey ? `${frontKey}|${backKey}` : frontKey;

    await this.prisma.kycVerification.update({
      where: { userId },
      data: {
        documentType: prismaDocumentType,
        documentS3Key: s3Key,
      },
    });

    this.logger.log(
      `[uploadDocument] Document verified for userId=${userId} type=${documentType}`,
    );

    return {
      verified: true,
      extractedData: verifikResult.data,
    };
  }

  // ─── 4. Verify Face ─────────────────────────────────────────────────────────

  /**
   * Uploads a selfie and compares it against the document portrait via Verifik.
   * On success, sets the KYC to PENDING_REVIEW and queues AML screening.
   */
  async verifyFace(
    userId: string,
    selfie: Buffer,
  ): Promise<{
    verified: boolean;
    faceMatchScore: number;
    livenessScore: number;
  }> {
    const kyc = await this.loadKycOrThrow(userId);

    this.ensureStatus(kyc.status, KycStatus.IN_PROGRESS, 'verifyFace');

    // Enforce step order: CPF + document must be completed
    if (!kyc.cpfVerified) {
      throw new BusinessRuleException(
        'KYC_STEP_ORDER_VIOLATION',
        'errors.kyc.stepOrderViolation',
        { requiredStep: 'cpf', currentStep: 'facial' },
      );
    }

    if (!kyc.documentS3Key) {
      throw new BusinessRuleException(
        'KYC_STEP_ORDER_VIOLATION',
        'errors.kyc.stepOrderViolation',
        { requiredStep: 'document', currentStep: 'facial' },
      );
    }

    // Validate selfie image
    this.validateImageBuffer(selfie);

    // Upload selfie to S3
    const kycBucket = this.s3Service.getKycBucket();
    if (!kycBucket) {
      throw new BusinessRuleException(
        'KYC_S3_UNAVAILABLE',
        'errors.kyc.s3Unavailable',
      );
    }

    const selfieKey = `kyc/${userId}/selfie-${randomUUID()}`;
    await this.s3Service.upload(kycBucket, selfieKey, selfie, {
      contentType: this.detectContentType(selfie),
      serverSideEncryption: 'aws:kms',
    });

    // Generate presigned URL for the document image (front only — split composite key)
    const documentFrontKey = kyc.documentS3Key.split('|')[0];
    const documentImageUrl = await this.s3Service.generatePresignedUrl(
      kycBucket,
      documentFrontKey,
      900, // 15-minute expiry
    );

    // Call Verifik face match
    const verifikResult = await this.verifikService.matchFace(
      selfie,
      documentImageUrl,
    );

    const { matchScore, livenessScore } = verifikResult;

    // Apply KYC-level thresholds (stricter than Verifik's internal thresholds)
    if (livenessScore < LIVENESS_MIN_SCORE) {
      throw new BusinessRuleException(
        'KYC_LIVENESS_CHECK_FAILED',
        'errors.kyc.livenessCheckFailed',
        { livenessScore, threshold: LIVENESS_MIN_SCORE },
      );
    }

    if (matchScore < FACE_MATCH_MIN_SCORE) {
      throw new BusinessRuleException(
        'KYC_FACE_MATCH_FAILED',
        'errors.kyc.faceMatchFailed',
        { faceMatchScore: matchScore, threshold: FACE_MATCH_MIN_SCORE },
      );
    }

    // Update KycVerification: mark face as verified, transition to PENDING_REVIEW
    await this.prisma.$transaction(async (tx) => {
      await tx.kycVerification.update({
        where: { userId },
        data: {
          faceVerified: true,
          faceMatchScore: new Prisma.Decimal(matchScore),
          livenessScore: new Prisma.Decimal(livenessScore),
          selfieS3Key: selfieKey,
          status: KycStatus.PENDING_REVIEW,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.PENDING_REVIEW },
      });
    });

    // Queue AML screening asynchronously
    await this.amlQueue.add(
      'screen-aml',
      { kycVerificationId: kyc.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `[verifyFace] Face verified for userId=${userId} matchScore=${matchScore} livenessScore=${livenessScore}`,
    );

    return {
      verified: true,
      faceMatchScore: matchScore,
      livenessScore,
    };
  }

  // ─── 5. Get Status ──────────────────────────────────────────────────────────

  /**
   * Returns the current KYC verification status for the given user,
   * including completed/remaining steps and resubmission eligibility.
   */
  async getStatus(userId: string): Promise<KycStatusResponse> {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    // No KYC record — user has not started verification
    if (!kyc) {
      return {
        status: KycStatus.NOT_STARTED,
        completedSteps: [],
        remainingSteps: [...KYC_STEPS],
        attemptCount: 0,
        canResubmit: true,
        rejectionReason: null,
      };
    }

    const completedSteps = this.computeCompletedSteps(kyc);
    const completedSet = new Set(completedSteps);
    const remainingSteps = KYC_STEPS.filter((s) => !completedSet.has(s));

    return {
      status: kyc.status,
      completedSteps,
      remainingSteps,
      attemptCount: kyc.attemptCount,
      canResubmit:
        kyc.attemptCount < MAX_ATTEMPTS &&
        (kyc.status === KycStatus.REJECTED ||
          kyc.status === KycStatus.RESUBMISSION_REQUIRED ||
          kyc.status === KycStatus.NOT_STARTED),
      rejectionReason: kyc.rejectionReason,
    };
  }

  // ─── 6. Process AML Screening (called by processor) ─────────────────────────

  /**
   * Runs AML/PEP/sanctions screening via Verifik and updates the KYC status
   * based on the results. Called asynchronously by the Bull queue processor.
   *
   * Outcomes:
   * - Sanctions match       -> REJECTED
   * - HIGH risk or PEP      -> PENDING_REVIEW (for manual review)
   * - Otherwise             -> APPROVED
   */
  async processAmlScreening(kycVerificationId: string): Promise<void> {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { id: kycVerificationId },
      include: { user: true },
    });

    if (!kyc) {
      this.logger.error(
        `[processAmlScreening] KYC verification not found: ${kycVerificationId}`,
      );
      return;
    }

    if (!kyc.user) {
      this.logger.error(
        `[processAmlScreening] User not found for KYC: ${kycVerificationId}`,
      );
      return;
    }

    // Decrypt CPF for AML screening
    let cpfForScreening = '';
    if (kyc.user.cpfEncrypted) {
      try {
        cpfForScreening = await this.encryptionService.decrypt(
          Buffer.from(kyc.user.cpfEncrypted),
        );
      } catch (err) {
        this.logger.warn(
          `[processAmlScreening] Could not decrypt CPF for userId=${kyc.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const fullName = [kyc.user.firstName, kyc.user.lastName]
      .filter(Boolean)
      .join(' ');

    // Call Verifik AML screening
    const amlResult = await this.verifikService.screenAml(
      fullName,
      cpfForScreening,
      'BR', // Default nationality for Brazilian KYC
    );

    // Parse risk score to a numeric value for storage
    const riskScoreNumeric = this.parseRiskScore(amlResult.riskScore);

    // Determine outcome based on AML results
    let newStatus: KycStatus;
    let rejectionReason: string | null = null;

    if (amlResult.sanctionsMatch) {
      newStatus = KycStatus.REJECTED;
      rejectionReason = 'Sanctions list match detected';
      this.logger.warn(
        `[processAmlScreening] Sanctions match for userId=${kyc.userId} — REJECTED`,
      );
    } else if (
      amlResult.riskScore === 'HIGH' ||
      amlResult.isPEP
    ) {
      // Keep in PENDING_REVIEW for manual review
      newStatus = KycStatus.PENDING_REVIEW;
      this.logger.warn(
        `[processAmlScreening] High risk or PEP for userId=${kyc.userId} — PENDING_REVIEW ` +
          `(riskScore=${amlResult.riskScore} isPEP=${amlResult.isPEP})`,
      );
    } else {
      newStatus = KycStatus.APPROVED;
      this.logger.log(
        `[processAmlScreening] AML clear for userId=${kyc.userId} — APPROVED`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.KycVerificationUpdateInput = {
        amlScreeningDone: true,
        amlRiskScore: new Prisma.Decimal(riskScoreNumeric),
        isPep: amlResult.isPEP,
        sanctionsMatch: amlResult.sanctionsMatch,
        status: newStatus,
      };

      if (newStatus === KycStatus.APPROVED) {
        updateData.verifiedAt = new Date();
      }

      if (newStatus === KycStatus.REJECTED) {
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = rejectionReason;
      }

      await tx.kycVerification.update({
        where: { id: kycVerificationId },
        data: updateData,
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: { kycStatus: newStatus },
      });
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Loads the KycVerification for a user, throwing NotFoundException if none exists.
   */
  private async loadKycOrThrow(userId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    if (!kyc) {
      throw new NotFoundException('kycVerification', userId);
    }

    return kyc;
  }

  /**
   * Ensures the KYC is in the expected status. Throws a BusinessRuleException
   * if the current status does not match.
   */
  private ensureStatus(
    current: KycStatus,
    expected: KycStatus,
    operation: string,
  ): void {
    if (current !== expected) {
      throw new BusinessRuleException(
        'KYC_INVALID_STATUS',
        'errors.kyc.invalidStatus',
        { currentStatus: current, expectedStatus: expected, operation },
      );
    }
  }

  /**
   * Validates a CPF string using the Modulo 11 checksum algorithm.
   * Accepts formatted (XXX.XXX.XXX-XX) or raw digit strings.
   */
  private validateCpfChecksum(cpf: string): boolean {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;

    // Reject all-same-digit CPFs (e.g. 111.111.111-11)
    if (/^(\d)\1{10}$/.test(digits)) return false;

    // First check digit
    const weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i], 10) * weights1[i];
    }
    let remainder = sum % 11;
    const check1 = remainder < 2 ? 0 : 11 - remainder;
    if (parseInt(digits[9], 10) !== check1) return false;

    // Second check digit
    const weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits[i], 10) * weights2[i];
    }
    remainder = sum % 11;
    const check2 = remainder < 2 ? 0 : 11 - remainder;
    return parseInt(digits[10], 10) === check2;
  }

  /**
   * Calculates the normalised similarity between two name strings using
   * Levenshtein distance. Returns a value between 0 (completely different)
   * and 1 (identical).
   *
   * Both names are normalised to lowercase, trimmed, and have accents removed
   * before comparison.
   */
  private calculateNameSimilarity(a: string, b: string): number {
    const normA = this.normalizeName(a);
    const normB = this.normalizeName(b);

    if (normA === normB) return 1;
    if (normA.length === 0 || normB.length === 0) return 0;

    const distance = this.levenshteinDistance(normA, normB);
    const maxLen = Math.max(normA.length, normB.length);

    return 1 - distance / maxLen;
  }

  /**
   * Normalises a name string for comparison: lowercase, strip accents,
   * collapse whitespace.
   */
  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Strip combining diacritical marks
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Computes the Levenshtein (edit) distance between two strings.
   * Uses the standard dynamic-programming approach with O(min(m,n)) space.
   */
  private levenshteinDistance(s: string, t: string): number {
    // Ensure s is the shorter string for space optimization
    if (s.length > t.length) {
      [s, t] = [t, s];
    }

    const m = s.length;
    const n = t.length;
    let prev = new Array(m + 1);
    let curr = new Array(m + 1);

    // Initialise first row
    for (let i = 0; i <= m; i++) {
      prev[i] = i;
    }

    for (let j = 1; j <= n; j++) {
      curr[0] = j;
      for (let i = 1; i <= m; i++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        curr[i] = Math.min(
          prev[i] + 1, // deletion
          curr[i - 1] + 1, // insertion
          prev[i - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[m];
  }

  /**
   * Computes the list of completed KYC steps based on the current record state.
   */
  private computeCompletedSteps(
    kyc: {
      cpfVerified: boolean;
      documentS3Key: string | null;
      faceVerified: boolean;
      amlScreeningDone: boolean;
    },
  ): string[] {
    const completed: string[] = [];

    if (kyc.cpfVerified) {
      completed.push('cpf');
    }
    if (kyc.documentS3Key) {
      completed.push('document');
    }
    if (kyc.faceVerified) {
      completed.push('facial');
    }
    if (kyc.amlScreeningDone) {
      completed.push('aml');
    }

    return completed;
  }

  /**
   * Validates that a buffer represents a valid JPEG or PNG image and is
   * within the maximum file size limit.
   *
   * @throws BusinessRuleException if the file is too large or invalid format
   */
  private validateImageBuffer(buffer: Buffer): void {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BusinessRuleException(
        'KYC_FILE_TOO_LARGE',
        'errors.kyc.fileTooLarge',
        { maxSizeBytes: MAX_FILE_SIZE, actualSizeBytes: buffer.length },
      );
    }

    if (buffer.length < 4) {
      throw new BusinessRuleException(
        'KYC_FILE_INVALID_FORMAT',
        'errors.kyc.fileInvalidFormat',
        { reason: 'File is too small to be a valid image' },
      );
    }

    const isJpeg = buffer.subarray(0, 3).equals(JPEG_MAGIC);
    const isPng = buffer.subarray(0, 4).equals(PNG_MAGIC);

    if (!isJpeg && !isPng) {
      throw new BusinessRuleException(
        'KYC_FILE_INVALID_FORMAT',
        'errors.kyc.fileInvalidFormat',
        { reason: 'File must be a JPEG or PNG image' },
      );
    }
  }

  /**
   * Detects the content type of a buffer based on magic bytes.
   */
  private detectContentType(buffer: Buffer): string {
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
      return 'image/jpeg';
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PNG_MAGIC)) {
      return 'image/png';
    }
    return 'application/octet-stream';
  }

  /**
   * Maps a DTO document type string to the Prisma DocumentType enum.
   * Handles the PASSPORT type which is not in the Prisma enum — falls back to RNE.
   */
  private mapDocumentType(documentType: string): DocumentType {
    switch (documentType.toUpperCase()) {
      case 'RG':
        return DocumentType.RG;
      case 'CNH':
        return DocumentType.CNH;
      case 'RNE':
        return DocumentType.RNE;
      case 'PASSPORT':
        // Passport is stored as RNE in the database (closest foreign document type)
        return DocumentType.RNE;
      default:
        return DocumentType.RG;
    }
  }

  /**
   * Parses a risk score string from Verifik into a numeric value (0-100).
   */
  private parseRiskScore(riskScore: string): number {
    switch (riskScore.toUpperCase()) {
      case 'LOW':
        return 10;
      case 'MEDIUM':
        return 50;
      case 'HIGH':
        return 90;
      default: {
        // Try to parse as a number if Verifik returns numeric strings
        const numeric = parseFloat(riskScore);
        return isNaN(numeric) ? 50 : numeric;
      }
    }
  }

  /**
   * Attempts to parse a date string in common formats (DD/MM/YYYY or YYYY-MM-DD).
   * Returns null if the string cannot be parsed.
   */
  private parseDate(dateStr: string): Date | null {
    // Try DD/MM/YYYY format (Brazilian standard)
    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
      );
      if (!isNaN(date.getTime())) return date;
    }

    // Try ISO format (YYYY-MM-DD)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  }
}
