import { Test, TestingModule } from '@nestjs/testing';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
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
const TEMPLATE_ID = 'tmpl-1';
const DOCUMENT_ID = 'doc-1';

const mockTemplate = {
  id: TEMPLATE_ID,
  companyId: COMPANY_ID,
  name: 'Acordo de Acionistas',
  documentType: 'SHAREHOLDER_AGREEMENT' as const,
  version: 1,
  isActive: true,
  createdAt: new Date('2026-01-15'),
};

const mockDocument = {
  id: DOCUMENT_ID,
  companyId: COMPANY_ID,
  templateId: TEMPLATE_ID,
  title: 'Test Document',
  locale: 'pt-BR',
  status: 'DRAFT' as const,
  formData: { companyName: 'Acme' },
  s3Key: null,
  contentHash: null,
  generatedAt: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const mockService = {
  findAllTemplates: jest.fn(),
  findTemplateById: jest.fn(),
  findAllDocuments: jest.fn(),
  findDocumentById: jest.fn(),
  createAndGenerate: jest.fn(),
  createDraft: jest.fn(),
  updateDraft: jest.fn(),
  generateFromDraft: jest.fn(),
  getPreviewHtml: jest.fn(),
  getDownloadUrl: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
};

describe('DocumentController', () => {
  let controller: DocumentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        { provide: DocumentService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    jest.clearAllMocks();
  });

  // ========================
  // List Templates
  // ========================

  describe('listTemplates', () => {
    it('should return paginated templates', async () => {
      mockService.findAllTemplates.mockResolvedValue({
        items: [mockTemplate],
        total: 1,
      });

      const result = await controller.listTemplates(COMPANY_ID, {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockTemplate],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      expect(mockService.findAllTemplates).toHaveBeenCalledWith(COMPANY_ID, {
        page: 1,
        limit: 20,
      });
    });

    it('should pass filter and search params', async () => {
      mockService.findAllTemplates.mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.listTemplates(COMPANY_ID, {
        page: 1,
        limit: 20,
        type: 'MEETING_MINUTES',
        search: 'ata',
      });

      expect(mockService.findAllTemplates).toHaveBeenCalledWith(COMPANY_ID, {
        page: 1,
        limit: 20,
        type: 'MEETING_MINUTES',
        search: 'ata',
      });
    });
  });

  // ========================
  // Get Template
  // ========================

  describe('getTemplate', () => {
    it('should return template detail', async () => {
      mockService.findTemplateById.mockResolvedValue(mockTemplate);

      const result = await controller.getTemplate(COMPANY_ID, TEMPLATE_ID);

      expect(result).toEqual(mockTemplate);
      expect(mockService.findTemplateById).toHaveBeenCalledWith(
        COMPANY_ID,
        TEMPLATE_ID,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.findTemplateById.mockRejectedValue(
        new NotFoundException('documentTemplate'),
      );

      await expect(
        controller.getTemplate(COMPANY_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // List Documents
  // ========================

  describe('listDocuments', () => {
    it('should return paginated documents', async () => {
      mockService.findAllDocuments.mockResolvedValue({
        items: [mockDocument],
        total: 1,
      });

      const result = await controller.listDocuments(COMPANY_ID, {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockDocument],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass status and search filters', async () => {
      mockService.findAllDocuments.mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.listDocuments(COMPANY_ID, {
        page: 2,
        limit: 10,
        status: 'GENERATED',
        search: 'acordo',
      });

      expect(mockService.findAllDocuments).toHaveBeenCalledWith(COMPANY_ID, {
        page: 2,
        limit: 10,
        status: 'GENERATED',
        search: 'acordo',
      });
    });
  });

  // ========================
  // Get Document
  // ========================

  describe('getDocument', () => {
    it('should return document detail', async () => {
      mockService.findDocumentById.mockResolvedValue(mockDocument);

      const result = await controller.getDocument(COMPANY_ID, DOCUMENT_ID);

      expect(result).toEqual(mockDocument);
      expect(mockService.findDocumentById).toHaveBeenCalledWith(
        COMPANY_ID,
        DOCUMENT_ID,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.findDocumentById.mockRejectedValue(
        new NotFoundException('document'),
      );

      await expect(
        controller.getDocument(COMPANY_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // Create Document (Generate)
  // ========================

  describe('createDocument', () => {
    const createDto = {
      templateId: TEMPLATE_ID,
      title: 'Test Agreement',
      formData: { companyName: 'Acme' },
    };

    it('should generate a document from template', async () => {
      const generated = {
        ...mockDocument,
        status: 'GENERATED',
        s3Key: 'documents/comp-1/123.pdf',
        contentHash: 'abc123',
        generatedAt: new Date(),
      };
      mockService.createAndGenerate.mockResolvedValue(generated);

      const result = await controller.createDocument(
        COMPANY_ID,
        mockUser as any,
        createDto,
      );

      expect(result).toEqual(generated);
      expect(mockService.createAndGenerate).toHaveBeenCalledWith(
        COMPANY_ID,
        mockUser.id,
        createDto,
      );
    });

    it('should propagate NotFoundException for missing template', async () => {
      mockService.createAndGenerate.mockRejectedValue(
        new NotFoundException('documentTemplate'),
      );

      await expect(
        controller.createDocument(COMPANY_ID, mockUser as any, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException for incomplete form', async () => {
      mockService.createAndGenerate.mockRejectedValue(
        new BusinessRuleException(
          'DOC_INCOMPLETE_FORM',
          'errors.doc.incompleteForm',
          { missingFields: ['companyName'] },
        ),
      );

      await expect(
        controller.createDocument(COMPANY_ID, mockUser as any, createDto),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Create Draft
  // ========================

  describe('createDraft', () => {
    const createDto = {
      templateId: TEMPLATE_ID,
      title: 'Draft Agreement',
      formData: { companyName: 'Acme' },
    };

    it('should create a draft document', async () => {
      mockService.createDraft.mockResolvedValue(mockDocument);

      const result = await controller.createDraft(
        COMPANY_ID,
        mockUser as any,
        createDto,
      );

      expect(result).toEqual(mockDocument);
      expect(mockService.createDraft).toHaveBeenCalledWith(
        COMPANY_ID,
        mockUser.id,
        createDto,
      );
    });

    it('should propagate NotFoundException for missing template', async () => {
      mockService.createDraft.mockRejectedValue(
        new NotFoundException('documentTemplate'),
      );

      await expect(
        controller.createDraft(COMPANY_ID, mockUser as any, createDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // Update Draft
  // ========================

  describe('updateDraft', () => {
    const updateDto = { title: 'Updated Title' };

    it('should update a draft document', async () => {
      const updated = { ...mockDocument, title: 'Updated Title' };
      mockService.updateDraft.mockResolvedValue(updated);

      const result = await controller.updateDraft(
        COMPANY_ID,
        DOCUMENT_ID,
        updateDto,
      );

      expect(result).toEqual(updated);
      expect(mockService.updateDraft).toHaveBeenCalledWith(
        COMPANY_ID,
        DOCUMENT_ID,
        updateDto,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.updateDraft.mockRejectedValue(
        new NotFoundException('document'),
      );

      await expect(
        controller.updateDraft(COMPANY_ID, 'nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException for non-draft', async () => {
      mockService.updateDraft.mockRejectedValue(
        new BusinessRuleException('DOC_NOT_DRAFT', 'errors.doc.notDraft'),
      );

      await expect(
        controller.updateDraft(COMPANY_ID, DOCUMENT_ID, updateDto),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Generate From Draft
  // ========================

  describe('generateFromDraft', () => {
    it('should generate PDF from draft', async () => {
      const generated = {
        ...mockDocument,
        status: 'GENERATED',
        s3Key: 'documents/comp-1/123.pdf',
        contentHash: 'abc123',
        generatedAt: new Date(),
      };
      mockService.generateFromDraft.mockResolvedValue(generated);

      const result = await controller.generateFromDraft(
        COMPANY_ID,
        DOCUMENT_ID,
      );

      expect(result).toEqual(generated);
      expect(mockService.generateFromDraft).toHaveBeenCalledWith(
        COMPANY_ID,
        DOCUMENT_ID,
      );
    });

    it('should propagate BusinessRuleException for non-draft', async () => {
      mockService.generateFromDraft.mockRejectedValue(
        new BusinessRuleException('DOC_NOT_DRAFT', 'errors.doc.notDraft'),
      );

      await expect(
        controller.generateFromDraft(COMPANY_ID, DOCUMENT_ID),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Get Preview
  // ========================

  describe('getPreview', () => {
    it('should return HTML preview', async () => {
      const html = '<h1>Acme</h1><p>Test</p>';
      mockService.getPreviewHtml.mockResolvedValue(html);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.getPreview(
        COMPANY_ID,
        DOCUMENT_ID,
        mockRes as any,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(mockRes.send).toHaveBeenCalledWith(html);
    });

    it('should propagate NotFoundException', async () => {
      mockService.getPreviewHtml.mockRejectedValue(
        new NotFoundException('document'),
      );

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await expect(
        controller.getPreview(COMPANY_ID, 'nonexistent', mockRes as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // Get Download
  // ========================

  describe('getDownload', () => {
    it('should return download URL', async () => {
      const downloadData = {
        downloadUrl: 'https://s3.example.com/doc.pdf?signed=1',
        expiresAt: '2026-01-15T01:00:00.000Z',
        filename: 'test-document.pdf',
      };
      mockService.getDownloadUrl.mockResolvedValue(downloadData);

      const result = await controller.getDownload(COMPANY_ID, DOCUMENT_ID);

      expect(result).toEqual(downloadData);
      expect(mockService.getDownloadUrl).toHaveBeenCalledWith(
        COMPANY_ID,
        DOCUMENT_ID,
      );
    });

    it('should propagate BusinessRuleException for non-generated', async () => {
      mockService.getDownloadUrl.mockRejectedValue(
        new BusinessRuleException(
          'DOC_NOT_GENERATED',
          'errors.doc.notGenerated',
        ),
      );

      await expect(
        controller.getDownload(COMPANY_ID, DOCUMENT_ID),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Upload Document
  // ========================

  describe('uploadDocument', () => {
    const mockFile = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]),
      size: 1024,
    } as Express.Multer.File;

    it('should upload a document', async () => {
      const uploaded = {
        ...mockDocument,
        status: 'GENERATED',
        s3Key: 'documents/comp-1/uploaded.pdf',
        contentHash: 'def456',
        generatedAt: new Date(),
        templateId: null,
      };
      mockService.uploadDocument.mockResolvedValue(uploaded);

      const result = await controller.uploadDocument(
        COMPANY_ID,
        mockUser as any,
        'Uploaded Doc',
        mockFile,
      );

      expect(result).toEqual(uploaded);
      expect(mockService.uploadDocument).toHaveBeenCalledWith(
        COMPANY_ID,
        mockUser.id,
        'Uploaded Doc',
        mockFile,
      );
    });

    it('should propagate BusinessRuleException for invalid file type', async () => {
      mockService.uploadDocument.mockRejectedValue(
        new BusinessRuleException(
          'DOC_INVALID_FILE_TYPE',
          'errors.doc.invalidFileType',
        ),
      );

      await expect(
        controller.uploadDocument(
          COMPANY_ID,
          mockUser as any,
          'Bad File',
          mockFile,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Delete Document
  // ========================

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      mockService.deleteDocument.mockResolvedValue(undefined);

      await controller.deleteDocument(COMPANY_ID, DOCUMENT_ID);

      expect(mockService.deleteDocument).toHaveBeenCalledWith(
        COMPANY_ID,
        DOCUMENT_ID,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.deleteDocument.mockRejectedValue(
        new NotFoundException('document'),
      );

      await expect(
        controller.deleteDocument(COMPANY_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException for document with signatures', async () => {
      mockService.deleteDocument.mockRejectedValue(
        new BusinessRuleException(
          'DOC_HAS_SIGNATURES',
          'errors.doc.hasSignatures',
        ),
      );

      await expect(
        controller.deleteDocument(COMPANY_ID, DOCUMENT_ID),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
