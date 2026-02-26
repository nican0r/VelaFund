import { Injectable, Logger } from '@nestjs/common';
import { DocumentCategory } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';

/** Maximum total storage per profile: 500 MB */
const MAX_STORAGE_BYTES = 500 * 1024 * 1024;

/** Maximum file size per upload: 25 MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** S3 prefix for profile documents */
const S3_PREFIX = 'profiles';

/**
 * Allowed MIME types and their magic bytes for file validation.
 * We validate both MIME type and magic bytes to prevent spoofed uploads.
 */
const ALLOWED_MIME_TYPES: Record<string, { ext: string; magicBytes?: number[] }> = {
  'application/pdf': { ext: '.pdf', magicBytes: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg': { ext: '.jpg', magicBytes: [0xff, 0xd8, 0xff] },
  'image/png': { ext: '.png', magicBytes: [0x89, 0x50, 0x4e, 0x47] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: '.xlsx',
    magicBytes: [0x50, 0x4b, 0x03, 0x04],
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    ext: '.pptx',
    magicBytes: [0x50, 0x4b, 0x03, 0x04],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: '.docx',
    magicBytes: [0x50, 0x4b, 0x03, 0x04],
  },
};

/** Redact IP to /24 subnet for privacy */
function redactIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const cleaned = ip.replace('::ffff:', '');
  const parts = cleaned.split('.');
  if (parts.length === 4) {
    parts[3] = '0/24';
    return parts.join('.');
  }
  return cleaned;
}

@Injectable()
export class ProfileDocumentService {
  private readonly logger = new Logger(ProfileDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  // ─── UPLOAD ──────────────────────────────────────────────────────────

  async upload(
    companyId: string,
    userId: string,
    file: Express.Multer.File,
    category: DocumentCategory,
    name?: string,
  ) {
    // Resolve profile
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    // Validate file type via magic bytes
    this.validateFileType(file);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BusinessRuleException('PROFILE_DOC_TOO_LARGE', 'errors.profile.docTooLarge', {
        maxSize: MAX_FILE_SIZE,
        fileSize: file.size,
      });
    }

    // Check total storage limit
    const currentStorage = await this.prisma.profileDocument.aggregate({
      where: { profileId: profile.id },
      _sum: { fileSize: true },
    });
    const totalAfterUpload = (currentStorage._sum.fileSize || 0) + file.size;
    if (totalAfterUpload > MAX_STORAGE_BYTES) {
      throw new BusinessRuleException('PROFILE_STORAGE_LIMIT', 'errors.profile.storageLimit', {
        currentUsage: currentStorage._sum.fileSize || 0,
        maxStorage: MAX_STORAGE_BYTES,
      });
    }

    // Check S3 availability
    if (!this.s3Service.isAvailable()) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    const bucket = this.s3Service.getDocumentsBucket();
    if (!bucket) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    // Generate S3 key
    const ext = ALLOWED_MIME_TYPES[file.mimetype]?.ext || '';
    const fileKey = `${S3_PREFIX}/${profile.id}/documents/${randomBytes(8).toString('hex')}${ext}`;

    // Upload to S3
    await this.s3Service.upload(bucket, fileKey, file.buffer, {
      contentType: file.mimetype,
    });

    // Extract PDF page count
    let pageCount: number | null = null;
    if (file.mimetype === 'application/pdf') {
      pageCount = this.extractPdfPageCount(file.buffer);
    }

    // Get next order value for this category
    const maxOrder = await this.prisma.profileDocument.aggregate({
      where: { profileId: profile.id, category },
      _max: { order: true },
    });

    const document = await this.prisma.profileDocument.create({
      data: {
        profileId: profile.id,
        name: name || file.originalname,
        category,
        fileKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        pageCount,
        order: (maxOrder._max.order ?? -1) + 1,
        uploadedById: userId,
        uploadedAt: new Date(),
      },
    });

    this.logger.log(
      `Document uploaded: ${document.id} (${file.mimetype}, ${file.size} bytes) for profile ${profile.id}`,
    );

    return document;
  }

  // ─── LIST ────────────────────────────────────────────────────────────

  async findAll(companyId: string, category?: DocumentCategory) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const where: any = { profileId: profile.id };
    if (category) {
      where.category = category;
    }

    const documents = await this.prisma.profileDocument.findMany({
      where,
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });

    // Calculate total storage
    const totalStorage = await this.prisma.profileDocument.aggregate({
      where: { profileId: profile.id },
      _sum: { fileSize: true },
    });

    return {
      documents,
      totalStorage: totalStorage._sum.fileSize || 0,
      maxStorage: MAX_STORAGE_BYTES,
    };
  }

  // ─── DELETE ──────────────────────────────────────────────────────────

  async delete(companyId: string, documentId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const document = await this.prisma.profileDocument.findFirst({
      where: { id: documentId, profileId: profile.id },
    });

    if (!document) {
      throw new NotFoundException('profileDocument', documentId);
    }

    // Delete from S3 (graceful — don't fail if S3 is unavailable)
    if (this.s3Service.isAvailable()) {
      const bucket = this.s3Service.getDocumentsBucket();
      if (bucket) {
        try {
          await this.s3Service.delete(bucket, document.fileKey);
          if (document.thumbnailKey) {
            await this.s3Service.delete(bucket, document.thumbnailKey);
          }
        } catch (err) {
          this.logger.warn(
            `Failed to delete S3 objects for document ${documentId}: ${err.message}`,
          );
        }
      }
    }

    // Delete from database (cascades to downloads)
    await this.prisma.profileDocument.delete({
      where: { id: documentId },
    });

    this.logger.log(`Document deleted: ${documentId} from profile ${profile.id}`);
  }

  // ─── REORDER ─────────────────────────────────────────────────────────

  async reorder(companyId: string, documents: Array<{ id: string; order: number }>) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    // Validate all document IDs belong to this profile
    const existingDocs = await this.prisma.profileDocument.findMany({
      where: { profileId: profile.id },
      select: { id: true },
    });
    const existingIds = new Set(existingDocs.map((d) => d.id));

    for (const doc of documents) {
      if (!existingIds.has(doc.id)) {
        throw new NotFoundException('profileDocument', doc.id);
      }
    }

    // Update orders in a transaction
    await this.prisma.$transaction(
      documents.map((doc) =>
        this.prisma.profileDocument.update({
          where: { id: doc.id },
          data: { order: doc.order },
        }),
      ),
    );

    return this.prisma.profileDocument.findMany({
      where: { profileId: profile.id },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  // ─── DOWNLOAD URL (AUTHENTICATED) ───────────────────────────────────

  async getDownloadUrl(companyId: string, documentId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const document = await this.prisma.profileDocument.findFirst({
      where: { id: documentId, profileId: profile.id },
    });

    if (!document) {
      throw new NotFoundException('profileDocument', documentId);
    }

    if (!this.s3Service.isAvailable()) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    const bucket = this.s3Service.getDocumentsBucket();
    if (!bucket) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    const downloadUrl = await this.s3Service.generatePresignedUrl(
      bucket,
      document.fileKey,
      900, // 15 minutes
    );

    return { downloadUrl, expiresIn: 900 };
  }

  // ─── PUBLIC DOWNLOAD URL ─────────────────────────────────────────────

  async getPublicDownloadUrl(
    slug: string,
    documentId: string,
    viewerEmail?: string,
    viewerIp?: string,
  ) {
    const document = await this.prisma.profileDocument.findFirst({
      where: { id: documentId },
      include: {
        profile: { select: { id: true, slug: true } },
      },
    });

    if (!document || document.profile.slug !== slug) {
      throw new NotFoundException('profileDocument', documentId);
    }

    if (!this.s3Service.isAvailable()) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    const bucket = this.s3Service.getDocumentsBucket();
    if (!bucket) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable');
    }

    // Record download event asynchronously
    this.recordDownload(documentId, document.profile.id, viewerEmail, viewerIp).catch((err) =>
      this.logger.warn(`Failed to record document download: ${err.message}`),
    );

    const downloadUrl = await this.s3Service.generatePresignedUrl(bucket, document.fileKey, 900);

    return { downloadUrl, expiresIn: 900 };
  }

  // ─── STORAGE INFO ────────────────────────────────────────────────────

  async getStorageUsage(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const totalStorage = await this.prisma.profileDocument.aggregate({
      where: { profileId: profile.id },
      _sum: { fileSize: true },
    });

    return {
      used: totalStorage._sum.fileSize || 0,
      max: MAX_STORAGE_BYTES,
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────

  /**
   * Validate file type by checking MIME type and magic bytes.
   */
  private validateFileType(file: Express.Multer.File): void {
    const config = ALLOWED_MIME_TYPES[file.mimetype];
    if (!config) {
      throw new BusinessRuleException('PROFILE_DOC_INVALID_TYPE', 'errors.profile.docInvalidType', {
        mimeType: file.mimetype,
      });
    }

    // Check magic bytes for file type verification
    if (config.magicBytes && file.buffer) {
      const header = Array.from(file.buffer.subarray(0, config.magicBytes.length));
      const matches = config.magicBytes.every((byte, i) => header[i] === byte);
      if (!matches) {
        throw new BusinessRuleException(
          'PROFILE_DOC_INVALID_TYPE',
          'errors.profile.docInvalidType',
          { mimeType: file.mimetype },
        );
      }
    }
  }

  /**
   * Extract page count from a PDF buffer using a simple approach.
   * Counts /Type /Page occurrences (excluding /Pages).
   * Returns null if extraction fails.
   */
  private extractPdfPageCount(buffer: Buffer): number | null {
    try {
      const text = buffer.toString('latin1');
      // Look for /Count N in the /Pages dictionary
      const countMatch = text.match(/\/Type\s*\/Pages[^]*?\/Count\s+(\d+)/);
      if (countMatch) {
        return parseInt(countMatch[1], 10);
      }
      // Fallback: count /Type /Page (not /Pages) occurrences
      const pageMatches = text.match(/\/Type\s*\/Page(?!s)\b/g);
      return pageMatches ? pageMatches.length : null;
    } catch {
      return null;
    }
  }

  /**
   * Record a document download event for analytics.
   */
  private async recordDownload(
    documentId: string,
    profileId: string,
    viewerEmail?: string,
    viewerIp?: string,
  ): Promise<void> {
    await this.prisma.profileDocumentDownload.create({
      data: {
        documentId,
        profileId,
        viewerEmail: viewerEmail ?? null,
        viewerIp: redactIp(viewerIp),
      },
    });
  }
}
