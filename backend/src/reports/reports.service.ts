import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  AppException,
} from '../common/filters/app-exception';
import { HttpStatus } from '@nestjs/common';
import { OwnershipQueryDto } from './dto/ownership-query.dto';
import { DilutionQueryDto } from './dto/dilution-query.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly exportsBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    @InjectQueue('report-export') private readonly exportQueue: Queue,
  ) {
    this.exportsBucket = this.configService.get<string>('AWS_S3_EXPORTS_BUCKET', 'navia-exports');
  }

  /**
   * Get ownership report for a company.
   * Computes ownership percentages, voting power, and option pool summary.
   */
  async getOwnershipReport(companyId: string, query: OwnershipQueryDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const whereClause: Prisma.ShareholdingWhereInput = { companyId };
    if (query.shareClassId) {
      whereClause.shareClassId = query.shareClassId;
    }

    const shareholdings = await this.prisma.shareholding.findMany({
      where: whereClause,
      include: {
        shareholder: {
          select: { id: true, name: true },
        },
        shareClass: {
          select: { id: true, className: true, votesPerShare: true },
        },
      },
    });

    const totalShares = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity),
      new Prisma.Decimal(0),
    );

    // Build option pool summary
    let optionPoolSummary = null;
    let totalFullyDiluted = totalShares;

    if (query.includeOptions !== false) {
      const optionPlans = await this.prisma.optionPlan.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          totalPoolSize: true,
          totalGranted: true,
          totalExercised: true,
        },
      });

      const grants = await this.prisma.optionGrant.findMany({
        where: { companyId, status: 'ACTIVE' },
      });

      const totalPool = optionPlans.reduce(
        (sum, p) => sum.plus(p.totalPoolSize),
        new Prisma.Decimal(0),
      );
      const granted = optionPlans.reduce(
        (sum, p) => sum.plus(p.totalGranted),
        new Prisma.Decimal(0),
      );
      const exercised = optionPlans.reduce(
        (sum, p) => sum.plus(p.totalExercised),
        new Prisma.Decimal(0),
      );

      // Calculate vested unexercised from grants
      const now = new Date();
      let vestedUnexercised = new Prisma.Decimal(0);
      let unvested = new Prisma.Decimal(0);

      for (const grant of grants) {
        const vested = this.calculateVestedOptions(grant, now);
        const exercisedAmount = grant.exercised;
        const vestedNotExercised = vested.minus(exercisedAmount);
        if (vestedNotExercised.greaterThan(0)) {
          vestedUnexercised = vestedUnexercised.plus(vestedNotExercised);
        }
        unvested = unvested.plus(grant.quantity.minus(vested));
      }

      const available = totalPool.minus(granted);

      optionPoolSummary = {
        totalPool: totalPool.toString(),
        granted: granted.toString(),
        exercised: exercised.toString(),
        vestedUnexercised: vestedUnexercised.toString(),
        unvested: unvested.toString(),
        available: available.toString(),
      };

      // Fully diluted includes granted options minus exercised (already in shareholdings)
      totalFullyDiluted = totalShares.plus(granted.minus(exercised));
    }

    const shareholders = shareholdings.map((sh) => {
      const percentage = totalShares.isZero()
        ? '0.00'
        : sh.quantity.div(totalShares).mul(100).toFixed(2);
      const fullyDilutedPercentage = totalFullyDiluted.isZero()
        ? '0.00'
        : sh.quantity.div(totalFullyDiluted).mul(100).toFixed(2);

      return {
        shareholderId: sh.shareholder.id,
        name: sh.shareholder.name,
        shareClassId: sh.shareClass.id,
        shareClassName: sh.shareClass.className,
        shares: sh.quantity.toString(),
        percentage,
        fullyDilutedPercentage,
      };
    });

    return {
      companyId: company.id,
      companyName: company.name,
      generatedAt: new Date().toISOString(),
      totalShares: totalShares.toString(),
      totalFullyDiluted: totalFullyDiluted.toString(),
      shareholders,
      optionPoolSummary,
    };
  }

  /**
   * Get dilution analysis data over time.
   */
  async getDilutionReport(companyId: string, query: DilutionQueryDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, createdAt: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();
    const dateFrom = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(dateTo.getTime() - 365 * 24 * 60 * 60 * 1000);
    const granularity = query.granularity || 'month';

    // Generate date points based on granularity
    const datePoints = this.generateDatePoints(dateFrom, dateTo, granularity);

    // Get all snapshots in the date range
    const snapshots = await this.prisma.capTableSnapshot.findMany({
      where: {
        companyId,
        snapshotDate: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    // For each date point, find the nearest snapshot
    const dataPoints = [];
    for (const date of datePoints) {
      const snapshot = this.findNearestSnapshot(snapshots, date);
      if (snapshot) {
        const data = snapshot.data as Record<string, unknown>;
        const entries = (data.entries || []) as Array<{
          shareClassId: string;
          shareClassName: string;
          shares: string;
        }>;

        const totalShares = entries.reduce(
          (sum, e) => sum.plus(new Prisma.Decimal(e.shares || '0')),
          new Prisma.Decimal(0),
        );

        const shareClasses = this.aggregateByShareClass(entries, totalShares);

        dataPoints.push({
          date: date.toISOString().split('T')[0],
          totalShares: totalShares.toString(),
          fullyDilutedShares: totalShares.toString(), // Snapshots don't track options
          shareClasses,
        });
      }
    }

    // Compute Gini coefficient from current shareholdings
    const currentShareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      select: { quantity: true },
    });
    const giniCoefficient = this.computeGiniCoefficient(currentShareholdings);

    // Compute foreign ownership percentage
    const foreignOwnershipPercentage = await this.computeForeignOwnership(companyId);

    return {
      companyId,
      generatedAt: new Date().toISOString(),
      dataPoints,
      giniCoefficient: giniCoefficient.toFixed(2),
      foreignOwnershipPercentage: foreignOwnershipPercentage.toFixed(2),
    };
  }

  /**
   * Get investor portfolio across all companies.
   */
  async getPortfolio(userId: string) {
    // Find all companies where user is a shareholder via their user ID link
    const shareholders = await this.prisma.shareholder.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        company: {
          select: { id: true, name: true },
        },
        shareholdings: {
          include: {
            shareClass: {
              select: { className: true },
            },
          },
        },
      },
    });

    // Get latest funding round price per share for each company
    const companyIds = [...new Set(shareholders.map((s) => s.companyId))];
    const latestRounds = await this.prisma.fundingRound.findMany({
      where: {
        companyId: { in: companyIds },
        status: 'CLOSED',
      },
      orderBy: { closedAt: 'desc' },
      distinct: ['companyId'],
      select: {
        companyId: true,
        pricePerShare: true,
      },
    });
    const roundPriceMap = new Map(latestRounds.map((r) => [r.companyId, r.pricePerShare]));

    // Get total invested from confirmed transactions (ISSUANCE type)
    const investments = await this.prisma.transaction.findMany({
      where: {
        companyId: { in: companyIds },
        type: 'ISSUANCE',
        status: 'CONFIRMED',
        toShareholderId: {
          in: shareholders.map((s) => s.id),
        },
      },
      select: {
        companyId: true,
        toShareholderId: true,
        totalValue: true,
      },
    });

    const holdings = [];
    let totalInvested = new Prisma.Decimal(0);
    let totalEstimatedValue = new Prisma.Decimal(0);

    for (const shareholder of shareholders) {
      for (const holding of shareholder.shareholdings) {
        const lastRoundPrice = roundPriceMap.get(shareholder.companyId) || new Prisma.Decimal(0);
        const estimatedValue = holding.quantity.mul(lastRoundPrice);

        // Sum invested amounts for this shareholder in this company
        const invested = investments
          .filter(
            (inv) =>
              inv.companyId === shareholder.companyId && inv.toShareholderId === shareholder.id,
          )
          .reduce(
            (sum, inv) => sum.plus(inv.totalValue || new Prisma.Decimal(0)),
            new Prisma.Decimal(0),
          );

        const roiMultiple = invested.isZero() ? '0.00' : estimatedValue.div(invested).toFixed(2);

        holdings.push({
          companyId: shareholder.company.id,
          companyName: shareholder.company.name,
          shareClassName: holding.shareClass.className,
          shares: holding.quantity.toString(),
          ownershipPercentage: holding.ownershipPct.toFixed(2),
          totalInvested: invested.toString(),
          estimatedValue: estimatedValue.toString(),
          lastRoundPricePerShare: lastRoundPrice.toString(),
          roiMultiple,
        });

        totalInvested = totalInvested.plus(invested);
        totalEstimatedValue = totalEstimatedValue.plus(estimatedValue);
      }
    }

    const weightedRoiMultiple = totalInvested.isZero()
      ? '0.00'
      : totalEstimatedValue.div(totalInvested).toFixed(2);

    return {
      userId,
      generatedAt: new Date().toISOString(),
      holdings,
      totals: {
        totalInvested: totalInvested.toString(),
        totalEstimatedValue: totalEstimatedValue.toString(),
        weightedRoiMultiple,
      },
    };
  }

  /**
   * Queue a cap table export job.
   */
  async exportCapTable(companyId: string, userId: string, format: string, snapshotDate?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    if (!['pdf', 'xlsx', 'csv', 'oct'].includes(format)) {
      throw new AppException(
        'REPORT_FORMAT_UNSUPPORTED',
        'errors.report.formatUnsupported',
        HttpStatus.BAD_REQUEST,
        { format },
      );
    }

    // Check for duplicate in-progress export (deduplication within 5 minutes)
    const existingJob = await this.findExistingJob(companyId, format);
    if (existingJob) {
      return this.formatExportJobResponse(existingJob);
    }

    // Create export job record
    const exportJob = await this.prisma.exportJob.create({
      data: {
        companyId,
        userId,
        type: 'CAP_TABLE_EXPORT',
        format,
        status: 'QUEUED',
        parameters: snapshotDate ? { snapshotDate } : undefined,
      },
    });

    // Queue async processing
    await this.exportQueue.add(
      'cap-table-export',
      {
        jobId: exportJob.id,
        companyId,
        format,
        snapshotDate,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log(
      `Cap table export queued: ${exportJob.id} (${format}) for company ${companyId}`,
    );

    return this.formatExportJobResponse(exportJob);
  }

  /**
   * Queue a due diligence package generation.
   */
  async generateDueDiligence(
    companyId: string,
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, createdAt: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const effectiveDateFrom = dateFrom || company.createdAt.toISOString();
    const effectiveDateTo = dateTo || new Date().toISOString();

    const exportJob = await this.prisma.exportJob.create({
      data: {
        companyId,
        userId,
        type: 'DUE_DILIGENCE',
        format: 'zip',
        status: 'QUEUED',
        parameters: {
          dateFrom: effectiveDateFrom,
          dateTo: effectiveDateTo,
        },
      },
    });

    await this.exportQueue.add(
      'due-diligence',
      {
        jobId: exportJob.id,
        companyId,
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(`Due diligence package queued: ${exportJob.id} for company ${companyId}`);

    return this.formatExportJobResponse(exportJob);
  }

  /**
   * Get export job status (for polling).
   */
  async getExportJobStatus(companyId: string, jobId: string) {
    const exportJob = await this.prisma.exportJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!exportJob) {
      throw new NotFoundException('exportJob', jobId);
    }

    // Check if download URL has expired
    if (
      exportJob.status === 'COMPLETED' &&
      exportJob.expiresAt &&
      exportJob.expiresAt < new Date()
    ) {
      throw new AppException(
        'REPORT_EXPORT_EXPIRED',
        'errors.report.exportExpired',
        HttpStatus.GONE,
        { jobId },
      );
    }

    return this.formatExportJobResponse(exportJob);
  }

  // ─── Generation methods (called by processor) ──────────────────────────

  /**
   * Generate CSV content for cap table export.
   */
  async generateCapTableCsv(companyId: string): Promise<Buffer> {
    const report = await this.getOwnershipReport(companyId, {
      includeOptions: true,
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    // Header
    lines.push('Acionista;Classe de Ação;Ações;Porcentagem;Porcentagem Diluída');

    // Data rows
    for (const sh of report.shareholders) {
      lines.push(
        [
          this.escapeCsvField(sh.name),
          this.escapeCsvField(sh.shareClassName),
          sh.shares,
          sh.percentage,
          sh.fullyDilutedPercentage,
        ].join(';'),
      );
    }

    // Summary row
    lines.push(['TOTAL', '', report.totalShares, '100.00', '100.00'].join(';'));

    return Buffer.from(BOM + lines.join('\r\n'), 'utf-8');
  }

  /**
   * Generate XLSX workbook for cap table export.
   */
  async generateCapTableXlsx(companyId: string): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const report = await this.getOwnershipReport(companyId, {
      includeOptions: true,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Navia';
    workbook.created = new Date();

    // Tab 1 — Summary
    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Campo', key: 'field', width: 30 },
      { header: 'Valor', key: 'value', width: 30 },
    ];
    summarySheet.addRow({ field: 'Empresa', value: report.companyName });
    summarySheet.addRow({
      field: 'Data de Geração',
      value: report.generatedAt,
    });
    summarySheet.addRow({ field: 'Total de Ações', value: report.totalShares });
    summarySheet.addRow({
      field: 'Total Diluído',
      value: report.totalFullyDiluted,
    });

    // Tab 2 — By Share Class
    const classSheet = workbook.addWorksheet('Por Classe');
    classSheet.columns = [
      { header: 'Classe de Ação', key: 'className', width: 25 },
      { header: 'Total de Ações', key: 'totalShares', width: 20 },
      { header: 'Porcentagem', key: 'percentage', width: 15 },
      { header: 'Acionistas', key: 'count', width: 15 },
    ];

    // Aggregate by share class
    const classMap = new Map<
      string,
      { className: string; totalShares: Prisma.Decimal; count: number }
    >();
    for (const sh of report.shareholders) {
      const existing = classMap.get(sh.shareClassId);
      if (existing) {
        existing.totalShares = existing.totalShares.plus(new Prisma.Decimal(sh.shares));
        existing.count += 1;
      } else {
        classMap.set(sh.shareClassId, {
          className: sh.shareClassName,
          totalShares: new Prisma.Decimal(sh.shares),
          count: 1,
        });
      }
    }
    const totalSharesDec = new Prisma.Decimal(report.totalShares);
    for (const entry of classMap.values()) {
      const pct = totalSharesDec.isZero()
        ? '0.00'
        : entry.totalShares.div(totalSharesDec).mul(100).toFixed(2);
      classSheet.addRow({
        className: entry.className,
        totalShares: entry.totalShares.toString(),
        percentage: pct,
        count: entry.count,
      });
    }

    // Tab 3 — By Shareholder
    const shSheet = workbook.addWorksheet('Por Acionista');
    shSheet.columns = [
      { header: 'Acionista', key: 'name', width: 30 },
      { header: 'Classe de Ação', key: 'shareClassName', width: 20 },
      { header: 'Ações', key: 'shares', width: 20 },
      { header: '%', key: 'percentage', width: 12 },
      { header: '% Diluído', key: 'fullyDilutedPercentage', width: 12 },
    ];
    for (const sh of report.shareholders) {
      shSheet.addRow({
        name: sh.name,
        shareClassName: sh.shareClassName,
        shares: sh.shares,
        percentage: sh.percentage,
        fullyDilutedPercentage: sh.fullyDilutedPercentage,
      });
    }

    // Tab 4 — Option Pool
    if (report.optionPoolSummary) {
      const optSheet = workbook.addWorksheet('Pool de Opções');
      optSheet.columns = [
        { header: 'Métrica', key: 'metric', width: 30 },
        { header: 'Valor', key: 'value', width: 20 },
      ];
      optSheet.addRow({
        metric: 'Pool Total',
        value: report.optionPoolSummary.totalPool,
      });
      optSheet.addRow({
        metric: 'Concedidas',
        value: report.optionPoolSummary.granted,
      });
      optSheet.addRow({
        metric: 'Exercidas',
        value: report.optionPoolSummary.exercised,
      });
      optSheet.addRow({
        metric: 'Adquiridas Não Exercidas',
        value: report.optionPoolSummary.vestedUnexercised,
      });
      optSheet.addRow({
        metric: 'Não Adquiridas',
        value: report.optionPoolSummary.unvested,
      });
      optSheet.addRow({
        metric: 'Disponíveis',
        value: report.optionPoolSummary.available,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF for cap table export via Puppeteer.
   */
  async generateCapTablePdf(companyId: string): Promise<Buffer> {
    const report = await this.getOwnershipReport(companyId, {
      includeOptions: true,
    });

    const html = this.renderCapTablePdfTemplate(report);

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '2cm', bottom: '2cm', left: '1.5cm', right: '1.5cm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="width: 100%; text-align: center; font-size: 10px; color: #6B7280;">
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate OCT JSON for cap table export.
   * Reuses cap-table module's OCT format logic inline.
   */
  async generateCapTableOct(companyId: string): Promise<Buffer> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        entityType: true,
        cnpj: true,
        foundedDate: true,
      },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const shareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      orderBy: { className: 'asc' },
    });

    const shareholders = await this.prisma.shareholder.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        shareholdings: {
          include: {
            shareClass: { select: { id: true, className: true } },
          },
        },
      },
    });

    const octData = {
      ocfVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      issuer: {
        id: company.id,
        legalName: company.name,
        entityType: company.entityType,
        jurisdiction: 'BR',
        taxId: company.cnpj,
        foundedDate: company.foundedDate?.toISOString() ?? null,
      },
      stockClasses: shareClasses.map((sc) => ({
        id: sc.id,
        name: sc.className,
        classType: sc.type === 'PREFERRED_SHARES' ? 'PREFERRED' : 'COMMON',
        authorizedShares: sc.totalAuthorized.toString(),
        issuedShares: sc.totalIssued.toString(),
        votesPerShare: sc.votesPerShare,
        liquidationPreferenceMultiple: sc.liquidationPreferenceMultiple?.toString() ?? null,
        participatingPreferred: sc.participatingRights,
        seniority: sc.seniority,
      })),
      stockholders: shareholders.map((sh) => ({
        id: sh.id,
        name: sh.name,
        stakeholderType: sh.type,
        nationality: sh.nationality,
        isForeign: sh.isForeign,
      })),
      stockIssuances: shareholders.flatMap((sh) =>
        sh.shareholdings.map((holding) => ({
          id: holding.id,
          stockholderId: sh.id,
          stockClassId: holding.shareClassId,
          stockClassName: holding.shareClass.className,
          quantity: holding.quantity.toString(),
          issuedAt: holding.createdAt.toISOString(),
        })),
      ),
    };

    return Buffer.from(JSON.stringify(octData, null, 2), 'utf-8');
  }

  /**
   * Generate due diligence CSV reports for ZIP packaging.
   */
  async generateDueDiligenceCsvs(companyId: string, dateFrom: string, dateTo: string) {
    const BOM = '\uFEFF';

    // Transactions CSV
    const transactions = await this.prisma.transaction.findMany({
      where: {
        companyId,
        createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      include: {
        fromShareholder: { select: { name: true } },
        toShareholder: { select: { name: true } },
        shareClass: { select: { className: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const txLines = ['Data;Tipo;De;Para;Classe;Quantidade;Preço/Ação;Valor Total;Status'];
    for (const tx of transactions) {
      txLines.push(
        [
          tx.createdAt.toISOString().split('T')[0],
          tx.type,
          this.escapeCsvField(tx.fromShareholder?.name || ''),
          this.escapeCsvField(tx.toShareholder?.name || ''),
          this.escapeCsvField(tx.shareClass.className),
          tx.quantity.toString(),
          tx.pricePerShare?.toString() || '',
          tx.totalValue?.toString() || '',
          tx.status,
        ].join(';'),
      );
    }
    const transactionsCsv = Buffer.from(BOM + txLines.join('\r\n'), 'utf-8');

    // Shareholders CSV (PII masked per LGPD)
    const shareholders = await this.prisma.shareholder.findMany({
      where: { companyId },
      include: {
        shareholdings: {
          include: { shareClass: { select: { className: true } } },
        },
      },
    });

    const shLines = ['Nome;Tipo;Status;Nacionalidade;Classe;Ações;Porcentagem'];
    for (const sh of shareholders) {
      for (const holding of sh.shareholdings) {
        shLines.push(
          [
            this.escapeCsvField(sh.name),
            sh.type,
            sh.status,
            sh.nationality,
            this.escapeCsvField(holding.shareClass.className),
            holding.quantity.toString(),
            holding.ownershipPct.toFixed(2),
          ].join(';'),
        );
      }
    }
    const shareholdersCsv = Buffer.from(BOM + shLines.join('\r\n'), 'utf-8');

    // Option grants CSV
    const grants = await this.prisma.optionGrant.findMany({
      where: { companyId },
      include: {
        plan: { select: { name: true } },
      },
      orderBy: { grantDate: 'asc' },
    });

    const grantLines = [
      'Funcionário;Plano;Quantidade;Preço de Exercício;Exercidas;Status;Data de Concessão;Expiração',
    ];
    for (const g of grants) {
      grantLines.push(
        [
          this.escapeCsvField(g.employeeName),
          this.escapeCsvField(g.plan.name),
          g.quantity.toString(),
          g.strikePrice.toString(),
          g.exercised.toString(),
          g.status,
          g.grantDate.toISOString().split('T')[0],
          g.expirationDate.toISOString().split('T')[0],
        ].join(';'),
      );
    }
    const optionGrantsCsv = Buffer.from(BOM + grantLines.join('\r\n'), 'utf-8');

    // Convertibles CSV
    const convertibles = await this.prisma.convertibleInstrument.findMany({
      where: { companyId },
      include: {
        shareholder: { select: { name: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    const convLines = [
      'Investidor;Tipo;Status;Principal;Taxa;Juros Acumulados;Cap;Desconto;Emissão;Vencimento',
    ];
    for (const c of convertibles) {
      convLines.push(
        [
          this.escapeCsvField(c.shareholder.name),
          c.instrumentType,
          c.status,
          c.principalAmount.toString(),
          c.interestRate.toString(),
          c.accruedInterest.toString(),
          c.valuationCap?.toString() || '',
          c.discountRate?.toString() || '',
          c.issueDate.toISOString().split('T')[0],
          c.maturityDate.toISOString().split('T')[0],
        ].join(';'),
      );
    }
    const convertiblesCsv = Buffer.from(BOM + convLines.join('\r\n'), 'utf-8');

    // Documents inventory CSV
    const documents = await this.prisma.document.findMany({
      where: { companyId },
      include: { template: { select: { documentType: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const docLines = ['Título;Tipo;Status;Hash;Criado Em'];
    for (const d of documents) {
      docLines.push(
        [
          this.escapeCsvField(d.title),
          d.template?.documentType || 'UPLOADED',
          d.status,
          d.contentHash || '',
          d.createdAt.toISOString().split('T')[0],
        ].join(';'),
      );
    }
    const documentsCsv = Buffer.from(BOM + docLines.join('\r\n'), 'utf-8');

    // Cap table history CSV (snapshots)
    const snapshots = await this.prisma.capTableSnapshot.findMany({
      where: {
        companyId,
        snapshotDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    const snapLines = ['Data;Hash de Estado;Notas'];
    for (const snap of snapshots) {
      snapLines.push(
        [
          snap.snapshotDate.toISOString().split('T')[0],
          snap.stateHash || '',
          this.escapeCsvField(snap.notes || ''),
        ].join(';'),
      );
    }
    const capTableHistoryCsv = Buffer.from(BOM + snapLines.join('\r\n'), 'utf-8');

    return {
      transactionsCsv,
      shareholdersCsv,
      optionGrantsCsv,
      convertiblesCsv,
      documentsCsv,
      capTableHistoryCsv,
    };
  }

  /**
   * Generate the metadata.json for due diligence package.
   */
  async generateDueDiligenceMetadata(
    companyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<Buffer> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, cnpj: true, entityType: true },
    });

    const metadata = {
      generatedAt: new Date().toISOString(),
      company: company
        ? {
            id: company.id,
            name: company.name,
            cnpj: company.cnpj,
            entityType: company.entityType,
          }
        : null,
      period: { from: dateFrom, to: dateTo },
      platform: 'Navia',
      version: '1.0.0',
    };

    return Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Upload export file to S3 and update job status.
   */
  async completeExportJob(
    jobId: string,
    fileBuffer: Buffer,
    contentType: string,
    fileExtension: string,
  ) {
    const exportJob = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });
    if (!exportJob) return;

    const s3Key = `exports/${exportJob.companyId || 'user'}/${jobId}.${fileExtension}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (this.s3Service.isAvailable()) {
      await this.s3Service.upload(this.exportsBucket, s3Key, fileBuffer, {
        contentType,
      });

      const downloadUrl = await this.s3Service.generatePresignedUrl(
        this.exportsBucket,
        s3Key,
        3600, // 1 hour
      );

      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          s3Key,
          downloadUrl,
          expiresAt,
          completedAt: new Date(),
        },
      });
    } else {
      // S3 not available — mark as completed without download URL
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Mark export job as failed.
   */
  async failExportJob(jobId: string, errorCode: string) {
    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorCode,
        completedAt: new Date(),
      },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────

  private async findExistingJob(companyId: string, format: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.prisma.exportJob.findFirst({
      where: {
        companyId,
        format,
        status: { in: ['QUEUED', 'PROCESSING'] },
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private formatExportJobResponse(job: {
    id: string;
    status: string;
    format: string | null;
    downloadUrl: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    completedAt: Date | null;
    errorCode: string | null;
  }) {
    return {
      jobId: job.id,
      status: job.status,
      format: job.format,
      downloadUrl: job.downloadUrl,
      expiresAt: job.expiresAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      errorCode: job.errorCode,
    };
  }

  /** Calculate vested options for a grant at a given date. */
  private calculateVestedOptions(
    grant: {
      quantity: Prisma.Decimal;
      grantDate: Date;
      cliffMonths: number;
      vestingDurationMonths: number;
      cliffPercentage: Prisma.Decimal;
    },
    now: Date,
  ): Prisma.Decimal {
    const grantDate = new Date(grant.grantDate);
    const monthsElapsed =
      (now.getFullYear() - grantDate.getFullYear()) * 12 + (now.getMonth() - grantDate.getMonth());

    if (monthsElapsed < grant.cliffMonths) {
      return new Prisma.Decimal(0);
    }

    if (monthsElapsed >= grant.vestingDurationMonths) {
      return grant.quantity;
    }

    // Cliff amount
    const cliffAmount = grant.quantity.mul(grant.cliffPercentage).div(100);

    // Remaining vests linearly
    const remainingAfterCliff = grant.quantity.minus(cliffAmount);
    const vestingMonthsAfterCliff = grant.vestingDurationMonths - grant.cliffMonths;
    const monthsAfterCliff = monthsElapsed - grant.cliffMonths;

    if (vestingMonthsAfterCliff <= 0) return grant.quantity;

    const linearVested = remainingAfterCliff.mul(monthsAfterCliff).div(vestingMonthsAfterCliff);

    return cliffAmount.plus(linearVested);
  }

  private generateDatePoints(from: Date, to: Date, granularity: string): Date[] {
    const points: Date[] = [];
    const current = new Date(from);

    while (current <= to) {
      points.push(new Date(current));
      if (granularity === 'day') {
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'week') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }
    return points;
  }

  private findNearestSnapshot(
    snapshots: Array<{ snapshotDate: Date; data: unknown }>,
    targetDate: Date,
  ) {
    let nearest = null;
    for (const snap of snapshots) {
      if (snap.snapshotDate <= targetDate) {
        nearest = snap;
      }
    }
    return nearest;
  }

  private aggregateByShareClass(
    entries: Array<{
      shareClassId: string;
      shareClassName: string;
      shares: string;
    }>,
    totalShares: Prisma.Decimal,
  ) {
    const classMap = new Map<
      string,
      { shareClassId: string; name: string; shares: Prisma.Decimal }
    >();
    for (const e of entries) {
      const existing = classMap.get(e.shareClassId);
      if (existing) {
        existing.shares = existing.shares.plus(new Prisma.Decimal(e.shares || '0'));
      } else {
        classMap.set(e.shareClassId, {
          shareClassId: e.shareClassId,
          name: e.shareClassName,
          shares: new Prisma.Decimal(e.shares || '0'),
        });
      }
    }
    return Array.from(classMap.values()).map((c) => ({
      shareClassId: c.shareClassId,
      name: c.name,
      shares: c.shares.toString(),
      percentage: totalShares.isZero() ? '0.00' : c.shares.div(totalShares).mul(100).toFixed(2),
    }));
  }

  /** Compute Gini coefficient from shareholdings. */
  private computeGiniCoefficient(
    shareholdings: Array<{ quantity: Prisma.Decimal }>,
  ): Prisma.Decimal {
    const n = shareholdings.length;
    if (n === 0) return new Prisma.Decimal(0);

    const sorted = shareholdings.map((s) => s.quantity).sort((a, b) => a.comparedTo(b));

    let numerator = new Prisma.Decimal(0);
    for (let i = 0; i < n; i++) {
      numerator = numerator.plus(sorted[i].mul(2 * (i + 1) - n - 1));
    }

    const denominator = new Prisma.Decimal(n).mul(
      sorted.reduce((sum, q) => sum.plus(q), new Prisma.Decimal(0)),
    );

    return denominator.isZero() ? new Prisma.Decimal(0) : numerator.div(denominator).abs();
  }

  /** Compute foreign ownership percentage. */
  private async computeForeignOwnership(companyId: string): Promise<Prisma.Decimal> {
    const shareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      include: {
        shareholder: {
          select: { isForeign: true },
        },
      },
    });

    const totalShares = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity),
      new Prisma.Decimal(0),
    );
    if (totalShares.isZero()) return new Prisma.Decimal(0);

    const foreignShares = shareholdings
      .filter((sh) => sh.shareholder.isForeign)
      .reduce((sum, sh) => sum.plus(sh.quantity), new Prisma.Decimal(0));

    return foreignShares.div(totalShares).mul(100);
  }

  private escapeCsvField(value: string): string {
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private renderCapTablePdfTemplate(report: {
    companyName: string;
    generatedAt: string;
    totalShares: string;
    totalFullyDiluted: string;
    shareholders: Array<{
      name: string;
      shareClassName: string;
      shares: string;
      percentage: string;
      fullyDilutedPercentage: string;
    }>;
    optionPoolSummary: {
      totalPool: string;
      granted: string;
      exercised: string;
      vestedUnexercised: string;
      unvested: string;
      available: string;
    } | null;
  }): string {
    const rows = report.shareholders
      .map(
        (sh) => `
      <tr>
        <td>${this.escapeHtml(sh.name)}</td>
        <td>${this.escapeHtml(sh.shareClassName)}</td>
        <td style="text-align:right">${sh.shares}</td>
        <td style="text-align:right">${sh.percentage}%</td>
        <td style="text-align:right">${sh.fullyDilutedPercentage}%</td>
      </tr>`,
      )
      .join('');

    const optionSection = report.optionPoolSummary
      ? `
      <h2>Pool de Opções</h2>
      <table>
        <tr><td>Pool Total</td><td style="text-align:right">${report.optionPoolSummary.totalPool}</td></tr>
        <tr><td>Concedidas</td><td style="text-align:right">${report.optionPoolSummary.granted}</td></tr>
        <tr><td>Exercidas</td><td style="text-align:right">${report.optionPoolSummary.exercised}</td></tr>
        <tr><td>Adquiridas Não Exercidas</td><td style="text-align:right">${report.optionPoolSummary.vestedUnexercised}</td></tr>
        <tr><td>Não Adquiridas</td><td style="text-align:right">${report.optionPoolSummary.unvested}</td></tr>
        <tr><td>Disponíveis</td><td style="text-align:right">${report.optionPoolSummary.available}</td></tr>
      </table>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1F2937; padding: 40px; }
    h1 { color: #0A2342; font-size: 24px; margin-bottom: 4px; }
    h2 { color: #1F2937; font-size: 18px; margin-top: 32px; }
    .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
    .summary { display: flex; gap: 40px; margin-bottom: 24px; }
    .summary-item { }
    .summary-label { color: #6B7280; font-size: 12px; }
    .summary-value { color: #0A2342; font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 16px; }
    th { background: #F9FAFB; color: #6B7280; text-align: left; padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; text-transform: uppercase; }
    td { padding: 8px 12px; border-bottom: 1px solid #F3F4F6; }
    tr:last-child td { border-bottom: 1px solid #E5E7EB; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(report.companyName)}</h1>
  <div class="subtitle">Cap Table — Gerado em ${new Date(report.generatedAt).toLocaleDateString('pt-BR')}</div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Total de Ações</div>
      <div class="summary-value">${report.totalShares}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Diluído</div>
      <div class="summary-value">${report.totalFullyDiluted}</div>
    </div>
  </div>

  <h2>Acionistas</h2>
  <table>
    <thead>
      <tr>
        <th>Acionista</th>
        <th>Classe</th>
        <th style="text-align:right">Ações</th>
        <th style="text-align:right">%</th>
        <th style="text-align:right">% Diluído</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <td>TOTAL</td>
        <td></td>
        <td style="text-align:right">${report.totalShares}</td>
        <td style="text-align:right">100.00%</td>
        <td style="text-align:right">100.00%</td>
      </tr>
    </tbody>
  </table>

  ${optionSection}
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
