import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

@Processor('report-export')
export class ReportExportProcessor {
  private readonly logger = new Logger(ReportExportProcessor.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('cap-table-export')
  async handleCapTableExport(
    job: Job<{
      jobId: string;
      companyId: string;
      format: string;
      snapshotDate?: string;
    }>,
  ) {
    const { jobId, companyId, format } = job.data;
    this.logger.log(
      `Processing cap table export ${jobId} (${format}) for company ${companyId}`,
    );

    // Mark as processing
    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    try {
      let fileBuffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      switch (format) {
        case 'csv':
          fileBuffer = await this.reportsService.generateCapTableCsv(companyId);
          contentType = 'text/csv; charset=utf-8';
          fileExtension = 'csv';
          break;
        case 'xlsx':
          fileBuffer =
            await this.reportsService.generateCapTableXlsx(companyId);
          contentType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'pdf':
          fileBuffer = await this.reportsService.generateCapTablePdf(companyId);
          contentType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        case 'oct':
          fileBuffer = await this.reportsService.generateCapTableOct(companyId);
          contentType = 'application/json';
          fileExtension = 'json';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      await this.reportsService.completeExportJob(
        jobId,
        fileBuffer,
        contentType,
        fileExtension,
      );

      // Send email notification
      await this.sendExportReadyEmail(jobId);

      this.logger.log(
        `Cap table export ${jobId} completed (${format}, ${fileBuffer.length} bytes)`,
      );
    } catch (error) {
      this.logger.error(
        `Cap table export ${jobId} failed: ${error.message}`,
        error.stack,
      );
      await this.reportsService.failExportJob(
        jobId,
        'REPORT_EXPORT_FAILED',
      );
      throw error;
    }
  }

  @Process('due-diligence')
  async handleDueDiligence(
    job: Job<{
      jobId: string;
      companyId: string;
      dateFrom: string;
      dateTo: string;
    }>,
  ) {
    const { jobId, companyId, dateFrom, dateTo } = job.data;
    this.logger.log(
      `Processing due diligence package ${jobId} for company ${companyId}`,
    );

    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Generate all CSV components
      const csvs = await this.reportsService.generateDueDiligenceCsvs(
        companyId,
        dateFrom,
        dateTo,
      );

      // Generate cap table PDF
      const capTablePdf =
        await this.reportsService.generateCapTablePdf(companyId);

      // Generate metadata
      const metadata =
        await this.reportsService.generateDueDiligenceMetadata(
          companyId,
          dateFrom,
          dateTo,
        );

      // Package into ZIP
      const zipBuffer = await this.createZipArchive({
        'cap-table-current.pdf': capTablePdf,
        'transactions.csv': csvs.transactionsCsv,
        'shareholders.csv': csvs.shareholdersCsv,
        'option-grants.csv': csvs.optionGrantsCsv,
        'convertibles.csv': csvs.convertiblesCsv,
        'documents-inventory.csv': csvs.documentsCsv,
        'cap-table-history.csv': csvs.capTableHistoryCsv,
        'metadata.json': metadata,
      });

      await this.reportsService.completeExportJob(
        jobId,
        zipBuffer,
        'application/zip',
        'zip',
      );

      await this.sendExportReadyEmail(jobId);

      this.logger.log(
        `Due diligence package ${jobId} completed (${zipBuffer.length} bytes)`,
      );
    } catch (error) {
      this.logger.error(
        `Due diligence package ${jobId} failed: ${error.message}`,
        error.stack,
      );
      await this.reportsService.failExportJob(
        jobId,
        'REPORT_EXPORT_FAILED',
      );
      throw error;
    }
  }

  private async createZipArchive(
    files: Record<string, Buffer>,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passthrough = new PassThrough();

      passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      archive.pipe(passthrough);

      for (const [filename, buffer] of Object.entries(files)) {
        archive.append(buffer, { name: filename });
      }

      archive.finalize();
    });
  }

  private async sendExportReadyEmail(jobId: string) {
    try {
      const exportJob = await this.prisma.exportJob.findUnique({
        where: { id: jobId },
        include: {
          user: { select: { email: true, locale: true, firstName: true } },
          company: { select: { name: true } },
        },
      });

      if (!exportJob || !this.emailService.isAvailable()) return;

      const formatNames: Record<string, string> = {
        pdf: 'PDF',
        xlsx: 'Excel',
        csv: 'CSV',
        oct: 'OCT JSON',
        zip: 'Due Diligence ZIP',
      };

      await this.emailService.sendEmail({
        to: exportJob.user.email,
        templateName: 'export-ready',
        locale: exportJob.user.locale || 'pt-BR',
        variables: {
          userName: exportJob.user.firstName || exportJob.user.email,
          companyName: exportJob.company?.name || 'Navia',
          formatName: formatNames[exportJob.format || 'pdf'] || exportJob.format || 'Export',
          downloadUrl: exportJob.downloadUrl || '#',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send export-ready email for job ${jobId}: ${error.message}`,
      );
    }
  }
}
