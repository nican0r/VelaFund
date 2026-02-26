import { Test, TestingModule } from '@nestjs/testing';
import { ProfileDocumentService } from './profile-document.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';

// ─── Mock Data ────────────────────────────────────────────────────────

const mockProfile = {
  id: 'profile-1',
  companyId: 'comp-1',
  slug: 'navia-tech-a1b2',
};

const mockDocument = {
  id: 'doc-1',
  profileId: 'profile-1',
  name: 'Pitch Deck 2026.pdf',
  category: 'PITCH_DECK' as const,
  fileKey: 'profiles/profile-1/documents/abc12345.pdf',
  fileSize: 2048000,
  mimeType: 'application/pdf',
  pageCount: 12,
  thumbnailKey: null,
  order: 0,
  uploadedById: 'user-1',
  uploadedAt: new Date('2026-02-25T10:00:00Z'),
  createdAt: new Date('2026-02-25T10:00:00Z'),
  updatedAt: new Date('2026-02-25T10:00:00Z'),
};

const mockDocument2 = {
  ...mockDocument,
  id: 'doc-2',
  name: 'Financials Q4.xlsx',
  category: 'FINANCIALS' as const,
  fileKey: 'profiles/profile-1/documents/def67890.xlsx',
  fileSize: 1024000,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pageCount: null,
  order: 0,
};

/** Create a minimal PDF buffer with valid magic bytes and /Pages /Count */
function createMockPdfBuffer(pageCount = 12): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count ${pageCount} >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj`;
  return Buffer.from(pdfContent, 'latin1');
}

/** Create a PNG buffer with valid magic bytes */
function createMockPngBuffer(): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, Buffer.alloc(100)]);
}

/** Create a JPEG buffer with valid magic bytes */
function createMockJpegBuffer(): Buffer {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  return Buffer.concat([header, Buffer.alloc(100)]);
}

/** Create a XLSX buffer with valid magic bytes (PK zip) */
function createMockXlsxBuffer(): Buffer {
  const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  return Buffer.concat([header, Buffer.alloc(100)]);
}

function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const pdfBuffer = createMockPdfBuffer();
  return {
    fieldname: 'file',
    originalname: 'Pitch_Deck_2026.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: pdfBuffer,
    size: pdfBuffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('ProfileDocumentService', () => {
  let service: ProfileDocumentService;
  let prisma: any;
  let s3Service: any;

  beforeEach(async () => {
    prisma = {
      companyProfile: {
        findUnique: jest.fn(),
      },
      profileDocument: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      profileDocumentDownload: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    s3Service = {
      isAvailable: jest.fn().mockReturnValue(true),
      getDocumentsBucket: jest.fn().mockReturnValue('navia-documents'),
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileDocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<ProfileDocumentService>(ProfileDocumentService);

    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks
    s3Service.isAvailable.mockReturnValue(true);
    s3Service.getDocumentsBucket.mockReturnValue('navia-documents');
    s3Service.upload.mockResolvedValue(undefined);
    s3Service.delete.mockResolvedValue(undefined);
    s3Service.generatePresignedUrl.mockResolvedValue('https://s3.example.com/presigned-url');
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════════════════════════════

  describe('upload', () => {
    const file = createMockFile();

    it('should upload a PDF document successfully', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } }) // current storage
        .mockResolvedValueOnce({ _max: { order: null } }); // max order
      prisma.profileDocument.create.mockResolvedValue(mockDocument);

      const result = await service.upload(
        'comp-1',
        'user-1',
        file,
        'PITCH_DECK' as any,
        'My Pitch Deck',
      );

      expect(result).toEqual(mockDocument);
      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-documents',
        expect.stringContaining('profiles/profile-1/documents/'),
        file.buffer,
        { contentType: 'application/pdf' },
      );
      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          profileId: 'profile-1',
          name: 'My Pitch Deck',
          category: 'PITCH_DECK',
          mimeType: 'application/pdf',
          uploadedById: 'user-1',
        }),
      });
    });

    it('should use original filename when no name provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue(mockDocument);

      await service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any);

      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Pitch_Deck_2026.pdf',
        }),
      });
    });

    it('should extract page count from PDF', async () => {
      const pdfFile = createMockFile({ buffer: createMockPdfBuffer(24) });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue(mockDocument);

      await service.upload('comp-1', 'user-1', pdfFile, 'PITCH_DECK' as any);

      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pageCount: 24,
        }),
      });
    });

    it('should set pageCount to null for non-PDF files', async () => {
      const pngFile = createMockFile({
        originalname: 'logo.png',
        mimetype: 'image/png',
        buffer: createMockPngBuffer(),
        size: 50000,
      });

      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue({
        ...mockDocument,
        pageCount: null,
      });

      await service.upload('comp-1', 'user-1', pngFile, 'OTHER' as any);

      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pageCount: null,
        }),
      });
    });

    it('should set order to 0 for first document in category', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue(mockDocument);

      await service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any);

      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 0,
        }),
      });
    });

    it('should increment order for subsequent documents', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: 2 } });
      prisma.profileDocument.create.mockResolvedValue(mockDocument);

      await service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any);

      expect(prisma.profileDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 3,
        }),
      });
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when file type is not allowed', async () => {
      const badFile = createMockFile({
        mimetype: 'application/zip',
        buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      await expect(service.upload('comp-1', 'user-1', badFile, 'OTHER' as any)).rejects.toThrow(
        BusinessRuleException,
      );

      try {
        await service.upload('comp-1', 'user-1', badFile, 'OTHER' as any);
      } catch (err) {
        expect(err.code).toBe('PROFILE_DOC_INVALID_TYPE');
      }
    });

    it('should throw when magic bytes do not match MIME type', async () => {
      const spoofedFile = createMockFile({
        mimetype: 'application/pdf',
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]),
      });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.upload('comp-1', 'user-1', spoofedFile, 'PITCH_DECK' as any),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw when file exceeds 25 MB limit', async () => {
      const largeFile = createMockFile({
        size: 26 * 1024 * 1024,
      });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.upload('comp-1', 'user-1', largeFile, 'PITCH_DECK' as any),
      ).rejects.toMatchObject({ code: 'PROFILE_DOC_TOO_LARGE' });
    });

    it('should throw when total storage exceeds 500 MB', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate.mockResolvedValueOnce({
        _sum: { fileSize: 499 * 1024 * 1024 }, // 499 MB used
      });

      const file2 = createMockFile({ size: 2 * 1024 * 1024 }); // 2 MB

      await expect(
        service.upload('comp-1', 'user-1', file2, 'PITCH_DECK' as any),
      ).rejects.toMatchObject({ code: 'PROFILE_STORAGE_LIMIT' });
    });

    it('should throw when S3 is unavailable', async () => {
      s3Service.isAvailable.mockReturnValue(false);
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate.mockResolvedValueOnce({
        _sum: { fileSize: 0 },
      });

      await expect(service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw when S3 bucket is not configured', async () => {
      s3Service.getDocumentsBucket.mockReturnValue(undefined);
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate.mockResolvedValueOnce({
        _sum: { fileSize: 0 },
      });

      await expect(service.upload('comp-1', 'user-1', file, 'PITCH_DECK' as any)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should upload XLSX files with correct extension', async () => {
      const xlsxFile = createMockFile({
        originalname: 'Financials.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: createMockXlsxBuffer(),
        size: 500000,
      });

      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue(mockDocument2);

      await service.upload('comp-1', 'user-1', xlsxFile, 'FINANCIALS' as any);

      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-documents',
        expect.stringMatching(/\.xlsx$/),
        xlsxFile.buffer,
        { contentType: xlsxFile.mimetype },
      );
    });

    it('should upload JPEG images successfully', async () => {
      const jpegFile = createMockFile({
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: createMockJpegBuffer(),
        size: 200000,
      });

      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate
        .mockResolvedValueOnce({ _sum: { fileSize: 0 } })
        .mockResolvedValueOnce({ _max: { order: null } });
      prisma.profileDocument.create.mockResolvedValue({
        ...mockDocument,
        mimeType: 'image/jpeg',
        pageCount: null,
      });

      await service.upload('comp-1', 'user-1', jpegFile, 'TEAM' as any);

      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-documents',
        expect.stringMatching(/\.jpg$/),
        jpegFile.buffer,
        { contentType: 'image/jpeg' },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIND ALL
  // ═══════════════════════════════════════════════════════════════════

  describe('findAll', () => {
    it('should return all documents with storage info', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findMany.mockResolvedValue([mockDocument, mockDocument2]);
      prisma.profileDocument.aggregate.mockResolvedValue({
        _sum: { fileSize: 3072000 },
      });

      const result = await service.findAll('comp-1');

      expect(result.documents).toHaveLength(2);
      expect(result.totalStorage).toBe(3072000);
      expect(result.maxStorage).toBe(500 * 1024 * 1024);
    });

    it('should filter by category', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findMany.mockResolvedValue([mockDocument]);
      prisma.profileDocument.aggregate.mockResolvedValue({
        _sum: { fileSize: 2048000 },
      });

      await service.findAll('comp-1', 'PITCH_DECK' as any);

      expect(prisma.profileDocument.findMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', category: 'PITCH_DECK' },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
      });
    });

    it('should return empty list when no documents', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findMany.mockResolvedValue([]);
      prisma.profileDocument.aggregate.mockResolvedValue({
        _sum: { fileSize: null },
      });

      const result = await service.findAll('comp-1');

      expect(result.documents).toHaveLength(0);
      expect(result.totalStorage).toBe(0);
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.findAll('comp-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════

  describe('delete', () => {
    it('should delete document from S3 and database', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(mockDocument);
      prisma.profileDocument.delete.mockResolvedValue(mockDocument);

      await service.delete('comp-1', 'doc-1');

      expect(s3Service.delete).toHaveBeenCalledWith('navia-documents', mockDocument.fileKey);
      expect(prisma.profileDocument.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });

    it('should delete thumbnail from S3 if it exists', async () => {
      const docWithThumbnail = {
        ...mockDocument,
        thumbnailKey: 'profiles/profile-1/thumbnails/abc.png',
      };
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(docWithThumbnail);
      prisma.profileDocument.delete.mockResolvedValue(docWithThumbnail);

      await service.delete('comp-1', 'doc-1');

      expect(s3Service.delete).toHaveBeenCalledTimes(2);
      expect(s3Service.delete).toHaveBeenCalledWith(
        'navia-documents',
        docWithThumbnail.thumbnailKey,
      );
    });

    it('should still delete from DB if S3 fails', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(mockDocument);
      prisma.profileDocument.delete.mockResolvedValue(mockDocument);
      s3Service.delete.mockRejectedValue(new Error('S3 network error'));

      await service.delete('comp-1', 'doc-1');

      expect(prisma.profileDocument.delete).toHaveBeenCalled();
    });

    it('should still delete from DB if S3 is unavailable', async () => {
      s3Service.isAvailable.mockReturnValue(false);
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(mockDocument);
      prisma.profileDocument.delete.mockResolvedValue(mockDocument);

      await service.delete('comp-1', 'doc-1');

      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(prisma.profileDocument.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.delete('comp-1', 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(null);

      await expect(service.delete('comp-1', 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('should not delete document from different profile', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(null); // Not found for this profile

      await expect(service.delete('comp-1', 'doc-other')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REORDER
  // ═══════════════════════════════════════════════════════════════════

  describe('reorder', () => {
    it('should reorder documents successfully', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findMany.mockResolvedValueOnce([{ id: 'doc-1' }, { id: 'doc-2' }]);
      prisma.$transaction.mockResolvedValue([]);
      prisma.profileDocument.findMany.mockResolvedValueOnce([
        { ...mockDocument, order: 1 },
        { ...mockDocument2, order: 0 },
      ]);

      const result = await service.reorder('comp-1', [
        { id: 'doc-2', order: 0 },
        { id: 'doc-1', order: 1 },
      ]);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.reorder('comp-1', [{ id: 'doc-1', order: 0 }])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid document ID', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findMany.mockResolvedValue([{ id: 'doc-1' }]);

      await expect(
        service.reorder('comp-1', [
          { id: 'doc-1', order: 0 },
          { id: 'doc-nonexistent', order: 1 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET DOWNLOAD URL
  // ═══════════════════════════════════════════════════════════════════

  describe('getDownloadUrl', () => {
    it('should return presigned URL with 15-minute expiry', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(mockDocument);

      const result = await service.getDownloadUrl('comp-1', 'doc-1');

      expect(result).toEqual({
        downloadUrl: 'https://s3.example.com/presigned-url',
        expiresIn: 900,
      });
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        'navia-documents',
        mockDocument.fileKey,
        900,
      );
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('comp-1', 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl('comp-1', 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when S3 is unavailable', async () => {
      s3Service.isAvailable.mockReturnValue(false);
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.findFirst.mockResolvedValue(mockDocument);

      await expect(service.getDownloadUrl('comp-1', 'doc-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET PUBLIC DOWNLOAD URL
  // ═══════════════════════════════════════════════════════════════════

  describe('getPublicDownloadUrl', () => {
    it('should return presigned URL and record download', async () => {
      prisma.profileDocument.findFirst.mockResolvedValue({
        ...mockDocument,
        profile: { id: 'profile-1', slug: 'navia-tech-a1b2' },
      });
      prisma.profileDocumentDownload.create.mockResolvedValue({});

      const result = await service.getPublicDownloadUrl(
        'navia-tech-a1b2',
        'doc-1',
        'investor@example.com',
        '192.168.1.42',
      );

      expect(result).toEqual({
        downloadUrl: 'https://s3.example.com/presigned-url',
        expiresIn: 900,
      });
    });

    it('should redact IP to /24 in download record', async () => {
      prisma.profileDocument.findFirst.mockResolvedValue({
        ...mockDocument,
        profile: { id: 'profile-1', slug: 'navia-tech-a1b2' },
      });
      prisma.profileDocumentDownload.create.mockResolvedValue({});

      await service.getPublicDownloadUrl('navia-tech-a1b2', 'doc-1', undefined, '192.168.1.42');

      // Wait for the async download record
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.profileDocumentDownload.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          viewerIp: '192.168.1.0/24',
        }),
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.profileDocument.findFirst.mockResolvedValue(null);

      await expect(service.getPublicDownloadUrl('navia-tech-a1b2', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when document does not belong to slug', async () => {
      prisma.profileDocument.findFirst.mockResolvedValue({
        ...mockDocument,
        profile: { id: 'profile-1', slug: 'other-company-xyz' },
      });

      await expect(service.getPublicDownloadUrl('navia-tech-a1b2', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when S3 is unavailable', async () => {
      s3Service.isAvailable.mockReturnValue(false);
      prisma.profileDocument.findFirst.mockResolvedValue({
        ...mockDocument,
        profile: { id: 'profile-1', slug: 'navia-tech-a1b2' },
      });

      await expect(service.getPublicDownloadUrl('navia-tech-a1b2', 'doc-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should not fail if download recording fails', async () => {
      prisma.profileDocument.findFirst.mockResolvedValue({
        ...mockDocument,
        profile: { id: 'profile-1', slug: 'navia-tech-a1b2' },
      });
      prisma.profileDocumentDownload.create.mockRejectedValue(new Error('DB error'));

      // Should not throw — download recording is fire-and-forget
      const result = await service.getPublicDownloadUrl('navia-tech-a1b2', 'doc-1');

      expect(result.downloadUrl).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET STORAGE USAGE
  // ═══════════════════════════════════════════════════════════════════

  describe('getStorageUsage', () => {
    it('should return storage usage', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate.mockResolvedValue({
        _sum: { fileSize: 150 * 1024 * 1024 },
      });

      const result = await service.getStorageUsage('comp-1');

      expect(result).toEqual({
        used: 150 * 1024 * 1024,
        max: 500 * 1024 * 1024,
      });
    });

    it('should return 0 when no documents', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.profileDocument.aggregate.mockResolvedValue({
        _sum: { fileSize: null },
      });

      const result = await service.getStorageUsage('comp-1');

      expect(result.used).toBe(0);
    });

    it('should throw NotFoundException when profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.getStorageUsage('comp-1')).rejects.toThrow(NotFoundException);
    });
  });
});
