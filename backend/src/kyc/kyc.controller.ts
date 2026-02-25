import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';
import { KycService } from './kyc.service';
import { VerifyCpfDto } from './dto/verify-cpf.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

/** Maximum file size for identity documents: 10 MB */
const DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum file size for selfie images: 5 MB */
const SELFIE_MAX_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('KYC')
@Controller('api/v1/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * Start a KYC verification session for the authenticated user.
   *
   * Creates or resumes a KYCVerification record for the user.
   * Returns the session state including which steps have been completed.
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'KYC_STARTED',
    resourceType: 'KycVerification',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Start or resume a KYC verification session' })
  @ApiResponse({ status: 200, description: 'KYC session started or resumed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 422, description: 'KYC already approved — cannot restart' })
  async start(@CurrentUser('id') userId: string) {
    return this.kycService.startVerification(userId);
  }

  /**
   * Verify the user's CPF against the Receita Federal registry via Verifik.
   *
   * Validates CPF format, date of birth match, and registers the result.
   * On success, updates the KYCVerification record and queues AML screening.
   */
  @Post('verify-cpf')
  @HttpCode(HttpStatus.OK)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'KYC_CPF_VERIFIED',
    resourceType: 'KycVerification',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Verify CPF against Receita Federal registry' })
  @ApiResponse({ status: 200, description: 'CPF verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid CPF format' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'CPF not found in registry' })
  @ApiResponse({ status: 422, description: 'Date of birth mismatch or CPF step already completed' })
  @ApiResponse({ status: 502, description: 'Verifik service unavailable' })
  async verifyCpf(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyCpfDto,
  ) {
    return this.kycService.verifyCpf(userId, dto);
  }

  /**
   * Upload and verify an identity document (RG, CNH, RNE, or Passport).
   *
   * Accepts the front image (required) and optionally the back image (for RG/CNH).
   * The file is passed to Verifik's OCR pipeline to extract and verify data.
   * File requirements: PNG or JPEG, max 10 MB per file.
   */
  @Post('upload-document')
  @HttpCode(HttpStatus.OK)
  @Throttle({ upload: { ttl: 60000, limit: 10 } })
  @Auditable({
    action: 'KYC_DOCUMENT_UPLOADED',
    resourceType: 'KycVerification',
    captureAfterState: true,
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'fileBack', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: DOCUMENT_MAX_FILE_SIZE },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload identity document for OCR verification' })
  @ApiResponse({ status: 200, description: 'Document uploaded and verified' })
  @ApiResponse({ status: 400, description: 'Missing file or invalid document type' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 422, description: 'Document unreadable or step not available' })
  @ApiResponse({ status: 502, description: 'Verifik service unavailable' })
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; fileBack?: Express.Multer.File[] },
    @Body() dto: UploadDocumentDto,
  ) {
    const frontFile = files?.file?.[0];
    if (!frontFile) {
      throw new BadRequestException({
        code: 'VAL_INVALID_INPUT',
        message: 'Document front image (file) is required',
        messageKey: 'errors.kyc.documentFileMissing',
      });
    }

    const backFile = files?.fileBack?.[0];

    return this.kycService.uploadDocument(
      userId,
      dto.documentType,
      dto.documentNumber,
      frontFile.buffer,
      backFile?.buffer ?? undefined,
    );
  }

  /**
   * Perform facial recognition and liveness detection via Verifik.
   *
   * Compares the uploaded selfie against the portrait from the previously
   * verified identity document.  The CPF and document verification steps
   * must be completed before this step.
   * File requirements: PNG or JPEG, max 5 MB.
   */
  @Post('verify-face')
  @HttpCode(HttpStatus.OK)
  @Throttle({ upload: { ttl: 60000, limit: 10 } })
  @Auditable({
    action: 'KYC_FACE_VERIFIED',
    resourceType: 'KycVerification',
    captureAfterState: true,
  })
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: memoryStorage(),
      limits: { fileSize: SELFIE_MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Verify face via selfie and liveness check' })
  @ApiResponse({ status: 200, description: 'Face verified successfully' })
  @ApiResponse({ status: 400, description: 'Missing selfie file' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 422,
    description: 'Liveness check failed, face match failed, or prerequisite steps incomplete',
  })
  @ApiResponse({ status: 502, description: 'Verifik service unavailable' })
  async verifyFace(
    @CurrentUser('id') userId: string,
    @UploadedFile() selfie: Express.Multer.File,
  ) {
    if (!selfie) {
      throw new BadRequestException({
        code: 'VAL_INVALID_INPUT',
        message: 'Selfie image is required',
        messageKey: 'errors.kyc.selfieMissing',
      });
    }

    return this.kycService.verifyFace(userId, selfie.buffer);
  }

  /**
   * Get the current KYC verification status for the authenticated user.
   *
   * Returns the verification status, completed/remaining steps, attempt count,
   * whether resubmission is allowed, and the rejection reason (if applicable).
   */
  @Get('status')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get KYC verification status for the current user' })
  @ApiResponse({ status: 200, description: 'KYC status' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.kycService.getStatus(userId);
  }
}
