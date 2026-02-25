import { Test, TestingModule } from '@nestjs/testing';
import {
  ProfileDocumentController,
  PublicDocumentController,
} from './profile-document.controller';
import { ProfileDocumentService } from './profile-document.service';
import { CompanyProfileService } from './company-profile.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';

const mockUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@test.com',
  walletAddress: null,
  firstName: 'Admin',
  lastName: 'User',
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

const COMPANY_ID = 'comp-1';
const DOCUMENT_ID = 'doc-1';
const SLUG = 'navia-tech-ab12';

const mockDocument = {
  id: DOCUMENT_ID,
  profileId: 'profile-1',
  name: 'Pitch Deck.pdf',
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

const mockDocumentList = {
  documents: [mockDocument],
  totalStorage: 2048000,
  maxStorage: 500 * 1024 * 1024,
};

const mockDownloadUrl = {
  downloadUrl: 'https://s3.example.com/presigned-url',
  expiresIn: 900,
};

const mockFile = {
  fieldname: 'file',
  originalname: 'Pitch_Deck.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4'),
  size: 2048000,
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
} as Express.Multer.File;

const mockDocumentService = {
  upload: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
  reorder: jest.fn(),
  getDownloadUrl: jest.fn(),
  getPublicDownloadUrl: jest.fn(),
  getStorageUsage: jest.fn(),
};

const mockProfileService = {
  getPublicProfile: jest.fn(),
};

describe('ProfileDocumentController & PublicDocumentController', () => {
  let docController: ProfileDocumentController;
  let publicController: PublicDocumentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileDocumentController, PublicDocumentController],
      providers: [
        { provide: ProfileDocumentService, useValue: mockDocumentService },
        { provide: CompanyProfileService, useValue: mockProfileService },
      ],
    }).compile();

    docController = module.get<ProfileDocumentController>(ProfileDocumentController);
    publicController = module.get<PublicDocumentController>(PublicDocumentController);
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════
  // ProfileDocumentController
  // ═══════════════════════════════════════════════════════════════════

  describe('ProfileDocumentController', () => {
    // ─── LIST DOCUMENTS ──────────────────────────────────────────

    describe('GET / (list)', () => {
      it('should return documents with storage info', async () => {
        mockDocumentService.findAll.mockResolvedValue(mockDocumentList);

        const result = await docController.list(COMPANY_ID);

        expect(result).toEqual(mockDocumentList);
        expect(mockDocumentService.findAll).toHaveBeenCalledWith(
          COMPANY_ID,
          undefined,
        );
      });

      it('should pass category filter', async () => {
        mockDocumentService.findAll.mockResolvedValue(mockDocumentList);

        await docController.list(COMPANY_ID, 'PITCH_DECK' as any);

        expect(mockDocumentService.findAll).toHaveBeenCalledWith(
          COMPANY_ID,
          'PITCH_DECK',
        );
      });

      it('should propagate NotFoundException', async () => {
        mockDocumentService.findAll.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(docController.list(COMPANY_ID)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    // ─── UPLOAD DOCUMENT ─────────────────────────────────────────

    describe('POST / (upload)', () => {
      it('should upload document successfully', async () => {
        mockDocumentService.upload.mockResolvedValue(mockDocument);

        const result = await docController.upload(
          COMPANY_ID,
          mockUser as any,
          mockFile,
          'PITCH_DECK' as any,
          'My Pitch Deck',
        );

        expect(result).toEqual(mockDocument);
        expect(mockDocumentService.upload).toHaveBeenCalledWith(
          COMPANY_ID,
          'user-1',
          mockFile,
          'PITCH_DECK',
          'My Pitch Deck',
        );
      });

      it('should throw when no file provided', async () => {
        await expect(
          docController.upload(
            COMPANY_ID,
            mockUser as any,
            undefined as any,
            'PITCH_DECK' as any,
          ),
        ).rejects.toThrow(BusinessRuleException);
      });

      it('should propagate storage limit error', async () => {
        mockDocumentService.upload.mockRejectedValue(
          new BusinessRuleException(
            'PROFILE_STORAGE_LIMIT',
            'errors.profile.storageLimit',
          ),
        );

        await expect(
          docController.upload(
            COMPANY_ID,
            mockUser as any,
            mockFile,
            'PITCH_DECK' as any,
          ),
        ).rejects.toThrow(BusinessRuleException);
      });

      it('should propagate invalid file type error', async () => {
        mockDocumentService.upload.mockRejectedValue(
          new BusinessRuleException(
            'PROFILE_DOC_INVALID_TYPE',
            'errors.profile.docInvalidType',
          ),
        );

        await expect(
          docController.upload(
            COMPANY_ID,
            mockUser as any,
            mockFile,
            'OTHER' as any,
          ),
        ).rejects.toThrow(BusinessRuleException);
      });
    });

    // ─── DELETE DOCUMENT ─────────────────────────────────────────

    describe('DELETE /:documentId (delete)', () => {
      it('should delete document successfully', async () => {
        mockDocumentService.delete.mockResolvedValue(undefined);

        await docController.delete(COMPANY_ID, DOCUMENT_ID);

        expect(mockDocumentService.delete).toHaveBeenCalledWith(
          COMPANY_ID,
          DOCUMENT_ID,
        );
      });

      it('should propagate NotFoundException', async () => {
        mockDocumentService.delete.mockRejectedValue(
          new NotFoundException('profileDocument', DOCUMENT_ID),
        );

        await expect(
          docController.delete(COMPANY_ID, DOCUMENT_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── REORDER DOCUMENTS ───────────────────────────────────────

    describe('PUT /order (reorder)', () => {
      it('should reorder documents successfully', async () => {
        const reorderedDocs = [
          { ...mockDocument, order: 1 },
          { ...mockDocument, id: 'doc-2', order: 0 },
        ];
        mockDocumentService.reorder.mockResolvedValue(reorderedDocs);

        const result = await docController.reorder(COMPANY_ID, {
          documents: [
            { id: 'doc-2', order: 0 },
            { id: DOCUMENT_ID, order: 1 },
          ],
        });

        expect(result).toEqual(reorderedDocs);
        expect(mockDocumentService.reorder).toHaveBeenCalledWith(
          COMPANY_ID,
          [
            { id: 'doc-2', order: 0 },
            { id: DOCUMENT_ID, order: 1 },
          ],
        );
      });

      it('should propagate NotFoundException for invalid document ID', async () => {
        mockDocumentService.reorder.mockRejectedValue(
          new NotFoundException('profileDocument', 'doc-nonexistent'),
        );

        await expect(
          docController.reorder(COMPANY_ID, {
            documents: [{ id: 'doc-nonexistent', order: 0 }],
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── DOWNLOAD URL ────────────────────────────────────────────

    describe('GET /:documentId/download', () => {
      it('should return presigned download URL', async () => {
        mockDocumentService.getDownloadUrl.mockResolvedValue(mockDownloadUrl);

        const result = await docController.download(COMPANY_ID, DOCUMENT_ID);

        expect(result).toEqual(mockDownloadUrl);
        expect(mockDocumentService.getDownloadUrl).toHaveBeenCalledWith(
          COMPANY_ID,
          DOCUMENT_ID,
        );
      });

      it('should propagate NotFoundException', async () => {
        mockDocumentService.getDownloadUrl.mockRejectedValue(
          new NotFoundException('profileDocument', DOCUMENT_ID),
        );

        await expect(
          docController.download(COMPANY_ID, DOCUMENT_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('should propagate S3 unavailable error', async () => {
        mockDocumentService.getDownloadUrl.mockRejectedValue(
          new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.sys.s3Unavailable'),
        );

        await expect(
          docController.download(COMPANY_ID, DOCUMENT_ID),
        ).rejects.toThrow(BusinessRuleException);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PublicDocumentController
  // ═══════════════════════════════════════════════════════════════════

  describe('PublicDocumentController', () => {
    const mockReq = {
      ip: '192.168.1.42',
      headers: {
        'user-agent': 'Mozilla/5.0',
        referer: 'https://google.com',
      },
    } as any;

    describe('GET /:slug/documents/:documentId/download', () => {
      it('should return presigned URL for public document', async () => {
        mockProfileService.getPublicProfile.mockResolvedValue({});
        mockDocumentService.getPublicDownloadUrl.mockResolvedValue(mockDownloadUrl);

        const result = await publicController.downloadPublicDocument(
          SLUG,
          DOCUMENT_ID,
          undefined,
          undefined,
          mockReq,
        );

        expect(result).toEqual(mockDownloadUrl);
        expect(mockProfileService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          undefined,
          undefined,
          '192.168.1.42',
          'Mozilla/5.0',
          'https://google.com',
        );
        expect(mockDocumentService.getPublicDownloadUrl).toHaveBeenCalledWith(
          SLUG,
          DOCUMENT_ID,
          undefined,
          '192.168.1.42',
        );
      });

      it('should pass password for password-protected profiles', async () => {
        mockProfileService.getPublicProfile.mockResolvedValue({});
        mockDocumentService.getPublicDownloadUrl.mockResolvedValue(mockDownloadUrl);

        await publicController.downloadPublicDocument(
          SLUG,
          DOCUMENT_ID,
          'secret123',
          undefined,
          mockReq,
        );

        expect(mockProfileService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          'secret123',
          undefined,
          expect.any(String),
          expect.any(String),
          expect.any(String),
        );
      });

      it('should pass email for email-gated profiles', async () => {
        mockProfileService.getPublicProfile.mockResolvedValue({});
        mockDocumentService.getPublicDownloadUrl.mockResolvedValue(mockDownloadUrl);

        await publicController.downloadPublicDocument(
          SLUG,
          DOCUMENT_ID,
          undefined,
          'investor@fund.com',
          mockReq,
        );

        expect(mockDocumentService.getPublicDownloadUrl).toHaveBeenCalledWith(
          SLUG,
          DOCUMENT_ID,
          'investor@fund.com',
          '192.168.1.42',
        );
      });

      it('should reject access when profile requires password', async () => {
        mockProfileService.getPublicProfile.mockRejectedValue(
          new BusinessRuleException(
            'PROFILE_PASSWORD_REQUIRED',
            'errors.profile.passwordRequired',
          ),
        );

        await expect(
          publicController.downloadPublicDocument(
            SLUG,
            DOCUMENT_ID,
            undefined,
            undefined,
            mockReq,
          ),
        ).rejects.toThrow(BusinessRuleException);

        expect(mockDocumentService.getPublicDownloadUrl).not.toHaveBeenCalled();
      });

      it('should propagate document not found error', async () => {
        mockProfileService.getPublicProfile.mockResolvedValue({});
        mockDocumentService.getPublicDownloadUrl.mockRejectedValue(
          new NotFoundException('profileDocument', DOCUMENT_ID),
        );

        await expect(
          publicController.downloadPublicDocument(
            SLUG,
            DOCUMENT_ID,
            undefined,
            undefined,
            mockReq,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
});
