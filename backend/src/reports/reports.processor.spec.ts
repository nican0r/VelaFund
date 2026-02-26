import { Test, TestingModule } from '@nestjs/testing';
import { ReportExportProcessor } from './reports.processor';
import { ReportsService } from './reports.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

// Must define inside the factory since jest.mock is hoisted above const declarations
const getMockArchive = () => {
  return (global as any).__mockArchive;
};

jest.mock('archiver', () => {
  const archive = {
    pipe: jest.fn(),
    append: jest.fn(),
    finalize: jest.fn(),
    on: jest.fn(),
  };
  (global as any).__mockArchive = archive;
  return jest.fn().mockReturnValue(archive);
});

describe('ReportExportProcessor', () => {
  let processor: ReportExportProcessor;
  let reportsService: typeof mockReportsService;
  let emailService: typeof mockEmailService;
  let prisma: typeof mockPrisma;

  const mockReportsService = {
    generateCapTableCsv: jest.fn().mockResolvedValue(Buffer.from('csv-data')),
    generateCapTableXlsx: jest.fn().mockResolvedValue(Buffer.from('xlsx-data')),
    generateCapTablePdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
    generateCapTableOct: jest.fn().mockResolvedValue(Buffer.from('oct-data')),
    generateDueDiligenceCsvs: jest.fn().mockResolvedValue({
      transactionsCsv: Buffer.from('txn'),
      shareholdersCsv: Buffer.from('sh'),
      optionGrantsCsv: Buffer.from('grants'),
      convertiblesCsv: Buffer.from('conv'),
      documentsCsv: Buffer.from('docs'),
      capTableHistoryCsv: Buffer.from('history'),
    }),
    generateDueDiligenceMetadata: jest.fn().mockResolvedValue(Buffer.from('{"metadata":true}')),
    completeExportJob: jest.fn().mockResolvedValue(undefined),
    failExportJob: jest.fn().mockResolvedValue(undefined),
  };

  const mockEmailService = {
    isAvailable: jest.fn().mockReturnValue(true),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockExportJobRecord = {
    id: 'job-1',
    format: 'pdf',
    downloadUrl: 'https://example.com/download/job-1',
    user: { email: 'test@example.com', locale: 'pt-BR', firstName: 'Nelson' },
    company: { name: 'Acme Ltda.' },
  };

  const mockPrisma = {
    exportJob: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(mockExportJobRecord),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset archiver pipe mock to simulate PassThrough stream behavior
    const mockArchive = getMockArchive();
    mockArchive.pipe.mockImplementation((stream: any) => {
      // Simulate archiver piping data then ending the stream
      setTimeout(() => {
        stream.emit('data', Buffer.from('zip-data'));
        stream.emit('end');
      }, 5);
      return mockArchive;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportExportProcessor,
        { provide: ReportsService, useValue: mockReportsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<ReportExportProcessor>(ReportExportProcessor);
    reportsService = module.get(ReportsService);
    emailService = module.get(EmailService);
    prisma = module.get(PrismaService);
  });

  // ---------------------------------------------------------------------------
  // handleCapTableExport
  // ---------------------------------------------------------------------------
  describe('handleCapTableExport', () => {
    const makeJob = (format: string, overrides?: Record<string, unknown>) =>
      ({
        data: {
          jobId: 'job-1',
          companyId: 'company-1',
          format,
          ...overrides,
        },
        id: 'bull-1',
      }) as any;

    it('should mark the export job as PROCESSING', async () => {
      await processor.handleCapTableExport(makeJob('csv'));

      expect(prisma.exportJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should generate CSV and complete export for csv format', async () => {
      await processor.handleCapTableExport(makeJob('csv'));

      expect(reportsService.generateCapTableCsv).toHaveBeenCalledWith('company-1');
      expect(reportsService.completeExportJob).toHaveBeenCalledWith(
        'job-1',
        Buffer.from('csv-data'),
        'text/csv; charset=utf-8',
        'csv',
      );
    });

    it('should generate XLSX and complete export for xlsx format', async () => {
      await processor.handleCapTableExport(makeJob('xlsx'));

      expect(reportsService.generateCapTableXlsx).toHaveBeenCalledWith('company-1');
      expect(reportsService.completeExportJob).toHaveBeenCalledWith(
        'job-1',
        Buffer.from('xlsx-data'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlsx',
      );
    });

    it('should generate PDF and complete export for pdf format', async () => {
      await processor.handleCapTableExport(makeJob('pdf'));

      expect(reportsService.generateCapTablePdf).toHaveBeenCalledWith('company-1');
      expect(reportsService.completeExportJob).toHaveBeenCalledWith(
        'job-1',
        Buffer.from('pdf-data'),
        'application/pdf',
        'pdf',
      );
    });

    it('should generate OCT JSON and complete export for oct format', async () => {
      await processor.handleCapTableExport(makeJob('oct'));

      expect(reportsService.generateCapTableOct).toHaveBeenCalledWith('company-1');
      expect(reportsService.completeExportJob).toHaveBeenCalledWith(
        'job-1',
        Buffer.from('oct-data'),
        'application/json',
        'json',
      );
    });

    it('should send export-ready email after successful generation', async () => {
      await processor.handleCapTableExport(makeJob('pdf'));

      expect(prisma.exportJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        include: {
          user: { select: { email: true, locale: true, firstName: true } },
          company: { select: { name: true } },
        },
      });
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        templateName: 'export-ready',
        locale: 'pt-BR',
        variables: {
          userName: 'Nelson',
          companyName: 'Acme Ltda.',
          formatName: 'PDF',
          downloadUrl: 'https://example.com/download/job-1',
        },
      });
    });

    it('should fail export job and re-throw on unsupported format', async () => {
      await expect(processor.handleCapTableExport(makeJob('html'))).rejects.toThrow(
        'Unsupported format: html',
      );

      expect(reportsService.failExportJob).toHaveBeenCalledWith('job-1', 'REPORT_EXPORT_FAILED');
      expect(reportsService.completeExportJob).not.toHaveBeenCalled();
    });

    it('should fail export job and re-throw when generation throws', async () => {
      const error = new Error('PDF engine crashed');
      mockReportsService.generateCapTablePdf.mockRejectedValueOnce(error);

      await expect(processor.handleCapTableExport(makeJob('pdf'))).rejects.toThrow(
        'PDF engine crashed',
      );

      expect(reportsService.failExportJob).toHaveBeenCalledWith('job-1', 'REPORT_EXPORT_FAILED');
      expect(reportsService.completeExportJob).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleDueDiligence
  // ---------------------------------------------------------------------------
  describe('handleDueDiligence', () => {
    const makeDdJob = (overrides?: Record<string, unknown>) =>
      ({
        data: {
          jobId: 'dd-job-1',
          companyId: 'company-1',
          dateFrom: '2025-01-01',
          dateTo: '2025-12-31',
          ...overrides,
        },
        id: 'bull-2',
      }) as any;

    it('should mark the export job as PROCESSING', async () => {
      await processor.handleDueDiligence(makeDdJob());

      expect(prisma.exportJob.update).toHaveBeenCalledWith({
        where: { id: 'dd-job-1' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should generate all due diligence components', async () => {
      await processor.handleDueDiligence(makeDdJob());

      expect(reportsService.generateDueDiligenceCsvs).toHaveBeenCalledWith(
        'company-1',
        '2025-01-01',
        '2025-12-31',
      );
      expect(reportsService.generateCapTablePdf).toHaveBeenCalledWith('company-1');
      expect(reportsService.generateDueDiligenceMetadata).toHaveBeenCalledWith(
        'company-1',
        '2025-01-01',
        '2025-12-31',
      );
    });

    it('should complete the export job with zip content type', async () => {
      await processor.handleDueDiligence(makeDdJob());

      expect(reportsService.completeExportJob).toHaveBeenCalledWith(
        'dd-job-1',
        expect.any(Buffer),
        'application/zip',
        'zip',
      );
    });

    it('should send export-ready email after completion', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
        ...mockExportJobRecord,
        id: 'dd-job-1',
        format: 'zip',
      });

      await processor.handleDueDiligence(makeDdJob());

      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should fail export job and re-throw when CSV generation fails', async () => {
      const error = new Error('Database timeout');
      mockReportsService.generateDueDiligenceCsvs.mockRejectedValueOnce(error);

      await expect(processor.handleDueDiligence(makeDdJob())).rejects.toThrow('Database timeout');

      expect(reportsService.failExportJob).toHaveBeenCalledWith('dd-job-1', 'REPORT_EXPORT_FAILED');
      expect(reportsService.completeExportJob).not.toHaveBeenCalled();
    });

    it('should fail export job and re-throw when metadata generation fails', async () => {
      const error = new Error('Metadata build error');
      mockReportsService.generateDueDiligenceMetadata.mockRejectedValueOnce(error);

      await expect(processor.handleDueDiligence(makeDdJob())).rejects.toThrow(
        'Metadata build error',
      );

      expect(reportsService.failExportJob).toHaveBeenCalledWith('dd-job-1', 'REPORT_EXPORT_FAILED');
    });
  });

  // ---------------------------------------------------------------------------
  // sendExportReadyEmail (tested via handleCapTableExport indirection)
  // ---------------------------------------------------------------------------
  describe('sendExportReadyEmail', () => {
    const makeJob = (format: string) =>
      ({
        data: { jobId: 'job-1', companyId: 'company-1', format },
        id: 'bull-1',
      }) as any;

    it('should not send email if export job is not found', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce(null);

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not send email if email service is unavailable', async () => {
      mockEmailService.isAvailable.mockReturnValueOnce(false);

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not throw when email sending fails (fire-and-forget)', async () => {
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      // Should complete without throwing
      await expect(processor.handleCapTableExport(makeJob('csv'))).resolves.toBeUndefined();

      // completeExportJob was still called successfully before email attempt
      expect(reportsService.completeExportJob).toHaveBeenCalled();
    });

    it('should use email as userName when firstName is absent', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
        ...mockExportJobRecord,
        user: {
          email: 'nofirstname@example.com',
          locale: 'en',
          firstName: null,
        },
      });

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'en',
          variables: expect.objectContaining({
            userName: 'nofirstname@example.com',
          }),
        }),
      );
    });

    it('should default locale to pt-BR when user locale is null', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
        ...mockExportJobRecord,
        user: {
          email: 'user@example.com',
          locale: null,
          firstName: 'Maria',
        },
      });

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'pt-BR',
        }),
      );
    });

    it('should map format names correctly for each format', async () => {
      const formatMappings: Record<string, string> = {
        pdf: 'PDF',
        xlsx: 'Excel',
        csv: 'CSV',
        oct: 'OCT JSON',
        zip: 'Due Diligence ZIP',
      };

      for (const [format, expectedName] of Object.entries(formatMappings)) {
        jest.clearAllMocks();
        mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
          ...mockExportJobRecord,
          format,
        });
        // Reset archiver pipe mock for each iteration
        const archive = getMockArchive();
        archive.pipe.mockImplementation((stream: any) => {
          setTimeout(() => {
            stream.emit('data', Buffer.from('zip-data'));
            stream.emit('end');
          }, 5);
          return archive;
        });

        // Use csv format for simplicity (it always works)
        await processor.handleCapTableExport(makeJob('csv'));

        expect(emailService.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            variables: expect.objectContaining({
              formatName: expectedName,
            }),
          }),
        );
      }
    });

    it('should use "Navia" as companyName when company is null', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
        ...mockExportJobRecord,
        company: null,
      });

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            companyName: 'Navia',
          }),
        }),
      );
    });

    it('should use "#" as downloadUrl when downloadUrl is null', async () => {
      mockPrisma.exportJob.findUnique.mockResolvedValueOnce({
        ...mockExportJobRecord,
        downloadUrl: null,
      });

      await processor.handleCapTableExport(makeJob('csv'));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            downloadUrl: '#',
          }),
        }),
      );
    });
  });
});
