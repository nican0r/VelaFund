import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentService } from './document.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { NotFoundException } from '../common/filters/app-exception';

// Mock puppeteer at module level
jest.mock('puppeteer', () => ({
  default: {
    launch: jest.fn(),
  },
}));

const COMPANY_ID = 'company-uuid-001';
const USER_ID = 'user-uuid-001';
const TEMPLATE_ID = 'template-uuid-001';
const DOCUMENT_ID = 'document-uuid-001';

function createMockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    companyId: COMPANY_ID,
    name: 'Acordo de Acionistas',
    documentType: 'SHAREHOLDER_AGREEMENT',
    content: '<h1>{{companyName}}</h1><p>{{description}}</p>',
    formSchema: {
      fields: [
        { name: 'companyName', type: 'text', required: true, label: 'Nome', labelEn: 'Name' },
        { name: 'description', type: 'text', required: false, label: 'Desc', labelEn: 'Desc' },
      ],
    },
    version: 1,
    isActive: true,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function createMockDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    companyId: COMPANY_ID,
    templateId: TEMPLATE_ID,
    title: 'Test Document',
    status: 'DRAFT',
    formData: { companyName: 'Acme Ltda.', description: 'Test' },
    s3Key: null,
    contentHash: null,
    blockchainTxHash: null,
    locale: 'pt-BR',
    generatedAt: null,
    anchoredAt: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
    ...overrides,
  };
}

describe('DocumentService', () => {
  let service: DocumentService;
  let prisma: any;
  let s3Service: any;

  beforeEach(async () => {
    prisma = {
      documentTemplate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
      },
      document: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    s3Service = {
      isAvailable: jest.fn().mockReturnValue(true),
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Service, useValue: s3Service },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── TEMPLATE METHODS ────────────────────────────────────────────

  describe('findAllTemplates', () => {
    it('should return paginated templates', async () => {
      const templates = [createMockTemplate()];
      prisma.documentTemplate.findMany.mockResolvedValue(templates);
      prisma.documentTemplate.count.mockResolvedValue(1);

      const result = await service.findAllTemplates(COMPANY_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual(templates);
      expect(result.total).toBe(1);
      expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID, isActive: true },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by document type', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([]);
      prisma.documentTemplate.count.mockResolvedValue(0);

      await service.findAllTemplates(COMPANY_ID, {
        page: 1,
        limit: 20,
        type: 'MEETING_MINUTES',
      });

      expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: COMPANY_ID,
            isActive: true,
            documentType: 'MEETING_MINUTES',
          },
        }),
      );
    });

    it('should search by name', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([]);
      prisma.documentTemplate.count.mockResolvedValue(0);

      await service.findAllTemplates(COMPANY_ID, {
        page: 1,
        limit: 20,
        search: 'Acordo',
      });

      expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: COMPANY_ID,
            isActive: true,
            name: { contains: 'Acordo', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  describe('findTemplateById', () => {
    it('should return a template by ID', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      const result = await service.findTemplateById(COMPANY_ID, TEMPLATE_ID);

      expect(result).toEqual(template);
      expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID, companyId: COMPANY_ID },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findTemplateById(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── DOCUMENT CREATION ──────────────────────────────────────────

  describe('createDraft', () => {
    it('should create a draft document', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);
      const created = createMockDocument();
      prisma.document.create.mockResolvedValue(created);

      const result = await service.createDraft(COMPANY_ID, USER_ID, {
        templateId: TEMPLATE_ID,
        title: 'Test Document',
        formData: { companyName: 'Acme Ltda.' },
      });

      expect(result).toEqual(created);
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          templateId: TEMPLATE_ID,
          title: 'Test Document',
          status: 'DRAFT',
          createdBy: USER_ID,
        }),
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraft(COMPANY_ID, USER_ID, {
          templateId: 'nonexistent',
          title: 'Test',
          formData: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException when template is inactive', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(createMockTemplate({ isActive: false }));

      await expect(
        service.createDraft(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: {},
        }),
      ).rejects.toMatchObject({
        code: 'DOC_TEMPLATE_INACTIVE',
      });
    });
  });

  describe('createAndGenerate', () => {
    it('should throw NotFoundException when template not found', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: 'nonexistent',
          title: 'Test',
          formData: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException when template is inactive', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(createMockTemplate({ isActive: false }));

      await expect(
        service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: { companyName: 'Acme' },
        }),
      ).rejects.toMatchObject({
        code: 'DOC_TEMPLATE_INACTIVE',
      });
    });

    it('should throw DOC_INCOMPLETE_FORM when required fields missing', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      await expect(
        service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: {}, // companyName is required but missing
        }),
      ).rejects.toMatchObject({
        code: 'DOC_INCOMPLETE_FORM',
        details: { missingFields: ['companyName'] },
      });
    });

    it('should generate document when PDF generation succeeds', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      // Mock puppeteer
      const mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const puppeteer = require('puppeteer');
      puppeteer.default.launch.mockResolvedValue(mockBrowser);

      const created = createMockDocument({
        status: 'GENERATED',
        contentHash: 'abc123',
        s3Key: 'documents/company-uuid-001/1234-abc123.pdf',
        generatedAt: new Date(),
      });
      prisma.document.create.mockResolvedValue(created);

      const result = await service.createAndGenerate(COMPANY_ID, USER_ID, {
        templateId: TEMPLATE_ID,
        title: 'Test',
        formData: { companyName: 'Acme Ltda.' },
      });

      expect(result.status).toBe('GENERATED');
      expect(result.contentHash).toBeTruthy();
      expect(puppeteer.default.launch).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(s3Service.upload).toHaveBeenCalled();
    });

    it('should throw DOC_GENERATION_FAILED when puppeteer fails', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      const puppeteer = require('puppeteer');
      puppeteer.default.launch.mockRejectedValue(new Error('Chrome crashed'));

      await expect(
        service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: { companyName: 'Acme' },
        }),
      ).rejects.toMatchObject({
        code: 'DOC_GENERATION_FAILED',
      });
    });
  });

  // ─── DOCUMENT LIST/GET ──────────────────────────────────────────

  describe('findAllDocuments', () => {
    it('should return paginated documents', async () => {
      const docs = [createMockDocument()];
      prisma.document.findMany.mockResolvedValue(docs);
      prisma.document.count.mockResolvedValue(1);

      const result = await service.findAllDocuments(COMPANY_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual(docs);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAllDocuments(COMPANY_ID, {
        page: 1,
        limit: 20,
        status: 'DRAFT',
      });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID, status: 'DRAFT' },
        }),
      );
    });

    it('should filter by type via template relation', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAllDocuments(COMPANY_ID, {
        page: 1,
        limit: 20,
        type: 'MEETING_MINUTES',
      });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: COMPANY_ID,
            template: { documentType: 'MEETING_MINUTES' },
          },
        }),
      );
    });

    it('should search by title', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAllDocuments(COMPANY_ID, {
        page: 1,
        limit: 20,
        search: 'Acordo',
      });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: COMPANY_ID,
            title: { contains: 'Acordo', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  describe('findDocumentById', () => {
    it('should return a document with template and signers', async () => {
      const doc = createMockDocument({
        template: { name: 'Acordo', documentType: 'SHAREHOLDER_AGREEMENT', version: 1 },
        signers: [],
      });
      prisma.document.findFirst.mockResolvedValue(doc);

      const result = await service.findDocumentById(COMPANY_ID, DOCUMENT_ID);

      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.findDocumentById(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── DRAFT UPDATE ─────────────────────────────────────────────

  describe('updateDraft', () => {
    it('should update a draft document', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument());
      const updated = createMockDocument({ title: 'Updated Title' });
      prisma.document.update.mockResolvedValue(updated);

      const result = await service.updateDraft(COMPANY_ID, DOCUMENT_ID, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraft(COMPANY_ID, 'nonexistent', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw DOC_NOT_DRAFT when document is not in DRAFT status', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument({ status: 'GENERATED' }));

      await expect(
        service.updateDraft(COMPANY_ID, DOCUMENT_ID, { title: 'test' }),
      ).rejects.toMatchObject({
        code: 'DOC_NOT_DRAFT',
      });
    });
  });

  // ─── GENERATE FROM DRAFT ──────────────────────────────────────

  describe('generateFromDraft', () => {
    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.generateFromDraft(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw DOC_NOT_DRAFT when document is already generated', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({ status: 'GENERATED', template: createMockTemplate() }),
      );

      await expect(service.generateFromDraft(COMPANY_ID, DOCUMENT_ID)).rejects.toMatchObject({
        code: 'DOC_NOT_DRAFT',
      });
    });

    it('should throw DOC_INCOMPLETE_FORM when required fields missing', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          formData: {}, // companyName required but missing
          template: createMockTemplate(),
        }),
      );

      await expect(service.generateFromDraft(COMPANY_ID, DOCUMENT_ID)).rejects.toMatchObject({
        code: 'DOC_INCOMPLETE_FORM',
      });
    });

    it('should generate PDF and update document', async () => {
      const docWithTemplate = createMockDocument({
        template: createMockTemplate(),
        formData: { companyName: 'Acme' },
      });
      prisma.document.findFirst.mockResolvedValue(docWithTemplate);

      const mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const puppeteer = require('puppeteer');
      puppeteer.default.launch.mockResolvedValue(mockBrowser);

      const updated = createMockDocument({
        status: 'GENERATED',
        contentHash: 'hash',
        s3Key: 'key',
        generatedAt: new Date(),
      });
      prisma.document.update.mockResolvedValue(updated);

      const result = await service.generateFromDraft(COMPANY_ID, DOCUMENT_ID);

      expect(result.status).toBe('GENERATED');
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: DOCUMENT_ID },
        data: expect.objectContaining({
          status: 'GENERATED',
        }),
      });
    });
  });

  // ─── PREVIEW ──────────────────────────────────────────────────

  describe('getPreviewHtml', () => {
    it('should return compiled HTML', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          formData: { companyName: 'Acme Ltda.', description: 'hello' },
          template: createMockTemplate(),
        }),
      );

      const html = await service.getPreviewHtml(COMPANY_ID, DOCUMENT_ID);

      expect(html).toContain('Acme Ltda.');
      expect(html).toContain('hello');
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getPreviewHtml(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument({ template: null }));

      await expect(service.getPreviewHtml(COMPANY_ID, DOCUMENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── DOWNLOAD ─────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('should return presigned URL', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({ s3Key: 'documents/test.pdf' }),
      );

      const result = await service.getDownloadUrl(COMPANY_ID, DOCUMENT_ID);

      expect(result.downloadUrl).toBe('https://s3.example.com/presigned');
      expect(result.filename).toContain('.pdf');
      expect(result.expiresAt).toBeTruthy();
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw DOC_NOT_GENERATED when no s3Key', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument({ s3Key: null }));

      await expect(service.getDownloadUrl(COMPANY_ID, DOCUMENT_ID)).rejects.toMatchObject({
        code: 'DOC_NOT_GENERATED',
      });
    });
  });

  // ─── UPLOAD ───────────────────────────────────────────────────

  describe('uploadDocument', () => {
    it('should upload a PDF file', async () => {
      const pdfBuffer = Buffer.alloc(1024);
      pdfBuffer[0] = 0x25; // %
      pdfBuffer[1] = 0x50; // P
      pdfBuffer[2] = 0x44; // D
      pdfBuffer[3] = 0x46; // F

      const created = createMockDocument({
        status: 'GENERATED',
        contentHash: 'hash',
      });
      prisma.document.create.mockResolvedValue(created);

      const result = await service.uploadDocument(COMPANY_ID, USER_ID, 'My PDF', {
        buffer: pdfBuffer,
        mimetype: 'application/pdf',
      } as Express.Multer.File);

      expect(result.status).toBe('GENERATED');
      expect(s3Service.upload).toHaveBeenCalled();
    });

    it('should upload a JPEG file', async () => {
      const jpgBuffer = Buffer.alloc(1024);
      jpgBuffer[0] = 0xff;
      jpgBuffer[1] = 0xd8;
      jpgBuffer[2] = 0xff;

      prisma.document.create.mockResolvedValue(createMockDocument());

      await service.uploadDocument(COMPANY_ID, USER_ID, 'My Image', {
        buffer: jpgBuffer,
        mimetype: 'image/jpeg',
      } as Express.Multer.File);

      expect(s3Service.upload).toHaveBeenCalled();
    });

    it('should upload a PNG file', async () => {
      const pngBuffer = Buffer.alloc(1024);
      pngBuffer[0] = 0x89;
      pngBuffer[1] = 0x50;
      pngBuffer[2] = 0x4e;
      pngBuffer[3] = 0x47;

      prisma.document.create.mockResolvedValue(createMockDocument());

      await service.uploadDocument(COMPANY_ID, USER_ID, 'My PNG', {
        buffer: pngBuffer,
        mimetype: 'image/png',
      } as Express.Multer.File);

      expect(s3Service.upload).toHaveBeenCalled();
    });

    it('should throw DOC_INVALID_FILE_TYPE for invalid magic bytes', async () => {
      const badBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      await expect(
        service.uploadDocument(COMPANY_ID, USER_ID, 'Bad File', {
          buffer: badBuffer,
          mimetype: 'application/octet-stream',
        } as Express.Multer.File),
      ).rejects.toMatchObject({
        code: 'DOC_INVALID_FILE_TYPE',
      });
    });

    it('should throw DOC_INVALID_FILE_TYPE for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(2);

      await expect(
        service.uploadDocument(COMPANY_ID, USER_ID, 'Empty', {
          buffer: emptyBuffer,
          mimetype: 'application/pdf',
        } as Express.Multer.File),
      ).rejects.toMatchObject({
        code: 'DOC_INVALID_FILE_TYPE',
      });
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('should delete a DRAFT document', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument({ _count: { signers: 0 } }));
      prisma.document.delete.mockResolvedValue(undefined);

      await service.deleteDocument(COMPANY_ID, DOCUMENT_ID);

      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: DOCUMENT_ID },
      });
    });

    it('should delete a GENERATED document without signers', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          status: 'GENERATED',
          s3Key: 'documents/test.pdf',
          _count: { signers: 0 },
        }),
      );
      prisma.document.delete.mockResolvedValue(undefined);

      await service.deleteDocument(COMPANY_ID, DOCUMENT_ID);

      expect(s3Service.delete).toHaveBeenCalledWith('navia-documents', 'documents/test.pdf');
      expect(prisma.document.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocument(COMPANY_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw DOC_HAS_SIGNATURES when signers exist', async () => {
      prisma.document.findFirst.mockResolvedValue(createMockDocument({ _count: { signers: 2 } }));

      await expect(service.deleteDocument(COMPANY_ID, DOCUMENT_ID)).rejects.toMatchObject({
        code: 'DOC_HAS_SIGNATURES',
      });
    });

    it('should throw DOC_HAS_SIGNATURES for non-deletable statuses', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          status: 'PENDING_SIGNATURES',
          _count: { signers: 0 },
        }),
      );

      await expect(service.deleteDocument(COMPANY_ID, DOCUMENT_ID)).rejects.toMatchObject({
        code: 'DOC_HAS_SIGNATURES',
      });
    });

    it('should handle S3 deletion failure gracefully', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          status: 'GENERATED',
          s3Key: 'documents/test.pdf',
          _count: { signers: 0 },
        }),
      );
      s3Service.delete.mockRejectedValue(new Error('S3 down'));
      prisma.document.delete.mockResolvedValue(undefined);

      // Should not throw — S3 delete failure is non-blocking
      await service.deleteDocument(COMPANY_ID, DOCUMENT_ID);

      expect(prisma.document.delete).toHaveBeenCalled();
    });
  });

  // ─── TEMPLATE SEEDING ─────────────────────────────────────────

  describe('seedTemplatesForCompany', () => {
    it('should seed 5 default templates for a new company', async () => {
      prisma.documentTemplate.count.mockResolvedValue(0);
      prisma.documentTemplate.createMany.mockResolvedValue({ count: 5 });

      await service.seedTemplatesForCompany(COMPANY_ID, USER_ID);

      expect(prisma.documentTemplate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            companyId: COMPANY_ID,
            documentType: 'SHAREHOLDER_AGREEMENT',
          }),
          expect.objectContaining({
            companyId: COMPANY_ID,
            documentType: 'MEETING_MINUTES',
          }),
          expect.objectContaining({
            companyId: COMPANY_ID,
            documentType: 'SHARE_CERTIFICATE',
          }),
          expect.objectContaining({
            companyId: COMPANY_ID,
            documentType: 'OPTION_LETTER',
          }),
          expect.objectContaining({
            companyId: COMPANY_ID,
            documentType: 'INVESTMENT_AGREEMENT',
          }),
        ]),
      });
    });

    it('should skip seeding when templates already exist', async () => {
      prisma.documentTemplate.count.mockResolvedValue(5);

      await service.seedTemplatesForCompany(COMPANY_ID, USER_ID);

      expect(prisma.documentTemplate.createMany).not.toHaveBeenCalled();
    });
  });

  // ─── HANDLEBARS COMPILATION ───────────────────────────────────

  describe('Handlebars template compilation', () => {
    it('should compile template with form data', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          formData: { companyName: 'Test Corp' },
          template: createMockTemplate(),
        }),
      );

      const html = await service.getPreviewHtml(COMPANY_ID, DOCUMENT_ID);

      expect(html).toContain('<h1>Test Corp</h1>');
    });

    it('should handle missing optional fields gracefully', async () => {
      prisma.document.findFirst.mockResolvedValue(
        createMockDocument({
          formData: { companyName: 'Test Corp' }, // description is optional
          template: createMockTemplate(),
        }),
      );

      const html = await service.getPreviewHtml(COMPANY_ID, DOCUMENT_ID);

      expect(html).toContain('Test Corp');
      // Should not throw for missing optional field
    });
  });

  // ─── FORM VALIDATION ──────────────────────────────────────────

  describe('form validation', () => {
    it('should pass validation when all required fields are present', async () => {
      const template = createMockTemplate();
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      const mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const puppeteer = require('puppeteer');
      puppeteer.default.launch.mockResolvedValue(mockBrowser);
      prisma.document.create.mockResolvedValue(createMockDocument());

      // Should not throw
      await service.createAndGenerate(COMPANY_ID, USER_ID, {
        templateId: TEMPLATE_ID,
        title: 'Test',
        formData: { companyName: 'Acme Ltda.' },
      });
    });

    it('should report multiple missing required fields', async () => {
      const template = createMockTemplate({
        formSchema: {
          fields: [
            { name: 'field1', type: 'text', required: true },
            { name: 'field2', type: 'text', required: true },
            { name: 'field3', type: 'text', required: false },
          ],
        },
      });
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      try {
        await service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: {},
        });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('DOC_INCOMPLETE_FORM');
        expect(e.details.missingFields).toEqual(['field1', 'field2']);
      }
    });

    it('should reject empty arrays for required array fields', async () => {
      const template = createMockTemplate({
        formSchema: {
          fields: [{ name: 'items', type: 'array', required: true }],
        },
      });
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      try {
        await service.createAndGenerate(COMPANY_ID, USER_ID, {
          templateId: TEMPLATE_ID,
          title: 'Test',
          formData: { items: [] },
        });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('DOC_INCOMPLETE_FORM');
        expect(e.details.missingFields).toContain('items');
      }
    });

    it('should skip validation when no form schema', async () => {
      const template = createMockTemplate({ formSchema: null });
      prisma.documentTemplate.findFirst.mockResolvedValue(template);

      const mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const puppeteer = require('puppeteer');
      puppeteer.default.launch.mockResolvedValue(mockBrowser);
      prisma.document.create.mockResolvedValue(createMockDocument());

      // Should not throw even with empty formData
      await service.createAndGenerate(COMPANY_ID, USER_ID, {
        templateId: TEMPLATE_ID,
        title: 'Test',
        formData: {},
      });
    });
  });
});
