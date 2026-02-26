import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as Handlebars from 'handlebars';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { ConfigService } from '@nestjs/config';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { parseSort } from '../common/helpers/sort-parser';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';

/** Allowed sort fields for templates */
const TEMPLATE_SORT_FIELDS = ['createdAt', 'name', 'documentType'];

/** Allowed sort fields for documents */
const DOCUMENT_SORT_FIELDS = ['createdAt', 'title', 'status', 'generatedAt'];

/** Handlebars custom helpers */
function registerHandlebarsHelpers(): void {
  if (!(Handlebars as any).__naviaHelpersRegistered) {
    Handlebars.registerHelper('formatNumber', (value: unknown) => {
      if (value == null) return '';
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('pt-BR').format(num);
    });
    Handlebars.registerHelper('formatCurrency', (value: unknown) => {
      if (value == null) return '';
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(num);
    });
    Handlebars.registerHelper('formatDate', (value: unknown) => {
      if (value == null) return '';
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('pt-BR').format(date);
    });
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    (Handlebars as any).__naviaHelpersRegistered = true;
  }
}

interface FormField {
  name: string;
  type: string;
  required: boolean;
  itemSchema?: FormField[];
}

interface FormSchema {
  fields: FormField[];
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly s3Bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.s3Bucket = this.configService.get<string>('AWS_S3_DOCUMENTS_BUCKET', 'navia-documents');
    registerHandlebarsHelpers();
  }

  // ─── TEMPLATE METHODS ──────────────────────────────────────────────

  async findAllTemplates(companyId: string, query: ListTemplatesQueryDto) {
    const { page, limit, type, search, sort } = query;

    const where: Prisma.DocumentTemplateWhereInput = {
      companyId,
      isActive: true,
    };

    if (type) {
      where.documentType = type as any;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const sortFields = parseSort(sort, TEMPLATE_SORT_FIELDS);
    const orderBy = sortFields.map((f) => ({ [f.field]: f.direction }));

    const [items, total] = await Promise.all([
      this.prisma.documentTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          documentType: true,
          version: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);

    return { items, total };
  }

  async findTemplateById(companyId: string, templateId: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });

    if (!template) {
      throw new NotFoundException('documentTemplate');
    }

    return template;
  }

  // ─── DOCUMENT METHODS ──────────────────────────────────────────────

  async createDraft(companyId: string, userId: string, dto: CreateDocumentDto) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: dto.templateId, companyId },
    });

    if (!template) {
      throw new NotFoundException('documentTemplate');
    }

    if (!template.isActive) {
      throw new BusinessRuleException('DOC_TEMPLATE_INACTIVE', 'errors.doc.templateInactive');
    }

    return this.prisma.document.create({
      data: {
        companyId,
        templateId: dto.templateId,
        title: dto.title,
        locale: dto.locale || 'pt-BR',
        formData: dto.formData as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdBy: userId,
      },
    });
  }

  async createAndGenerate(companyId: string, userId: string, dto: CreateDocumentDto) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: dto.templateId, companyId },
    });

    if (!template) {
      throw new NotFoundException('documentTemplate');
    }

    if (!template.isActive) {
      throw new BusinessRuleException('DOC_TEMPLATE_INACTIVE', 'errors.doc.templateInactive');
    }

    // Validate required fields
    this.validateFormData(template.formSchema as FormSchema | null, dto.formData);

    // Compile template with form data
    const html = this.compileTemplate(template.content, dto.formData);

    // Generate PDF
    const pdfBuffer = await this.generatePdf(html);

    // Compute content hash
    const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');

    // Upload to S3
    const s3Key = `documents/${companyId}/${Date.now()}-${contentHash.slice(0, 8)}.pdf`;
    await this.uploadToS3(s3Key, pdfBuffer);

    // Create document record
    return this.prisma.document.create({
      data: {
        companyId,
        templateId: dto.templateId,
        title: dto.title,
        locale: dto.locale || 'pt-BR',
        formData: dto.formData as Prisma.InputJsonValue,
        status: 'GENERATED',
        s3Key,
        contentHash,
        generatedAt: new Date(),
        createdBy: userId,
      },
    });
  }

  async findAllDocuments(companyId: string, query: ListDocumentsQueryDto) {
    const { page, limit, status, type, search, sort } = query;

    const where: Prisma.DocumentWhereInput = { companyId };

    if (status) {
      where.status = status as any;
    }

    if (type) {
      where.template = { documentType: type as any };
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const sortFields = parseSort(sort, DOCUMENT_SORT_FIELDS);
    const orderBy = sortFields.map((f) => ({ [f.field]: f.direction }));

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          templateId: true,
          status: true,
          contentHash: true,
          generatedAt: true,
          createdAt: true,
          createdBy: true,
          template: {
            select: { documentType: true, name: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total };
  }

  async findDocumentById(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: {
        template: {
          select: { name: true, documentType: true, version: true },
        },
        signers: {
          select: {
            id: true,
            name: true,
            email: true,
            signerRole: true,
            status: true,
            signedAt: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    return document;
  }

  async updateDraft(companyId: string, documentId: string, dto: UpdateDraftDto) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    if (document.status !== 'DRAFT') {
      throw new BusinessRuleException('DOC_NOT_DRAFT', 'errors.doc.notDraft');
    }

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.formData !== undefined && {
          formData: dto.formData as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async generateFromDraft(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: { template: true },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    if (document.status !== 'DRAFT') {
      throw new BusinessRuleException('DOC_NOT_DRAFT', 'errors.doc.notDraft');
    }

    if (!document.template) {
      throw new NotFoundException('documentTemplate');
    }

    const formData = (document.formData as Record<string, unknown>) || {};

    // Validate required fields
    this.validateFormData(document.template.formSchema as FormSchema | null, formData);

    // Compile and generate PDF
    const html = this.compileTemplate(document.template.content, formData);
    const pdfBuffer = await this.generatePdf(html);

    const contentHash = createHash('sha256').update(pdfBuffer).digest('hex');

    const s3Key = `documents/${companyId}/${Date.now()}-${contentHash.slice(0, 8)}.pdf`;
    await this.uploadToS3(s3Key, pdfBuffer);

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'GENERATED',
        s3Key,
        contentHash,
        generatedAt: new Date(),
      },
    });
  }

  async getPreviewHtml(companyId: string, documentId: string): Promise<string> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: { template: true },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    if (!document.template) {
      throw new NotFoundException('documentTemplate');
    }

    const formData = (document.formData as Record<string, unknown>) || {};
    return this.compileTemplate(document.template.content, formData);
  }

  async getDownloadUrl(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    if (!document.s3Key) {
      throw new BusinessRuleException('DOC_NOT_GENERATED', 'errors.doc.notGenerated');
    }

    const downloadUrl = await this.s3Service.generatePresignedUrl(this.s3Bucket, document.s3Key);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Sanitize filename for Content-Disposition
    const filename = document.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .concat('.pdf');

    return { downloadUrl, expiresAt: expiresAt.toISOString(), filename };
  }

  async uploadDocument(
    companyId: string,
    userId: string,
    title: string,
    file: Express.Multer.File,
  ) {
    // Validate file type via magic bytes
    this.validateFileType(file.buffer);

    // Compute content hash
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');

    // Upload to S3
    const ext = this.getFileExtension(file.buffer);
    const s3Key = `documents/${companyId}/${Date.now()}-${contentHash.slice(0, 8)}.${ext}`;
    await this.uploadToS3(s3Key, file.buffer, file.mimetype);

    return this.prisma.document.create({
      data: {
        companyId,
        title,
        status: 'GENERATED',
        s3Key,
        contentHash,
        generatedAt: new Date(),
        createdBy: userId,
      },
    });
  }

  async deleteDocument(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: { _count: { select: { signers: true } } },
    });

    if (!document) {
      throw new NotFoundException('document');
    }

    if (document._count.signers > 0) {
      throw new BusinessRuleException('DOC_HAS_SIGNATURES', 'errors.doc.hasSignatures');
    }

    if (document.status !== 'DRAFT' && document.status !== 'GENERATED') {
      throw new BusinessRuleException('DOC_HAS_SIGNATURES', 'errors.doc.hasSignatures');
    }

    // Delete S3 object if it exists
    if (document.s3Key) {
      try {
        await this.s3Service.delete(this.s3Bucket, document.s3Key);
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${document.s3Key}: ${err}`);
      }
    }

    await this.prisma.document.delete({ where: { id: documentId } });
  }

  // ─── TEMPLATE SEEDING ──────────────────────────────────────────────

  async seedTemplatesForCompany(companyId: string, createdBy: string) {
    const existing = await this.prisma.documentTemplate.count({
      where: { companyId },
    });

    if (existing > 0) {
      this.logger.log(`Templates already exist for company ${companyId}, skipping seed`);
      return;
    }

    const templates = this.getDefaultTemplates();

    await this.prisma.documentTemplate.createMany({
      data: templates.map((t) => ({
        companyId,
        name: t.name,
        documentType: t.documentType as any,
        content: t.content,
        formSchema: t.formSchema as Prisma.InputJsonValue,
        version: 1,
        isActive: true,
        createdBy,
      })),
    });

    this.logger.log(`Seeded ${templates.length} document templates for company ${companyId}`);
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────

  private compileTemplate(templateContent: string, formData: Record<string, unknown>): string {
    const compiled = Handlebars.compile(templateContent);
    return compiled(formData);
  }

  private async generatePdf(html: string): Promise<Buffer> {
    let browser: any = null;
    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(this.wrapInHtmlDocument(html), {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdfUint8 = await page.pdf({
        format: 'A4',
        margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="font-size:9px;text-align:center;width:100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });

      return Buffer.from(pdfUint8);
    } catch (err) {
      this.logger.error(`PDF generation failed: ${err}`);
      throw new BusinessRuleException('DOC_GENERATION_FAILED', 'errors.doc.generationFailed');
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  private wrapInHtmlDocument(body: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 24pt; color: #0A2342; }
    h2 { font-size: 14pt; margin-top: 18pt; margin-bottom: 8pt; color: #0A2342; border-bottom: 1px solid #E0E0E0; padding-bottom: 4pt; }
    h3 { font-size: 12pt; margin-top: 14pt; margin-bottom: 6pt; }
    p { margin: 6pt 0; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
    th, td { border: 1px solid #E0E0E0; padding: 6pt 8pt; text-align: left; font-size: 11pt; }
    th { background-color: #F3F4F6; font-weight: 600; }
    .signature-block { margin-top: 48pt; }
    .signature-line { border-top: 1px solid #1a1a1a; width: 250px; margin-top: 48pt; padding-top: 4pt; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
  }

  private async uploadToS3(
    s3Key: string,
    buffer: Buffer,
    contentType = 'application/pdf',
  ): Promise<void> {
    if (!this.s3Service.isAvailable()) {
      this.logger.warn('S3 not available, skipping upload');
      return;
    }

    await this.s3Service.upload(this.s3Bucket, s3Key, buffer, {
      contentType,
    });
  }

  private validateFormData(schema: FormSchema | null, formData: Record<string, unknown>): void {
    if (!schema || !schema.fields) return;

    const missingFields: string[] = [];

    for (const field of schema.fields) {
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || value === '') {
          missingFields.push(field.name);
        } else if (field.type === 'array' && Array.isArray(value) && value.length === 0) {
          missingFields.push(field.name);
        }
      }
    }

    if (missingFields.length > 0) {
      throw new BusinessRuleException('DOC_INCOMPLETE_FORM', 'errors.doc.incompleteForm', {
        missingFields,
      });
    }
  }

  private validateFileType(buffer: Buffer): void {
    if (buffer.length < 4) {
      throw new BusinessRuleException('DOC_INVALID_FILE_TYPE', 'errors.doc.invalidFileType');
    }

    const isPdf =
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47; // .PNG

    if (!isPdf && !isJpeg && !isPng) {
      throw new BusinessRuleException('DOC_INVALID_FILE_TYPE', 'errors.doc.invalidFileType');
    }
  }

  private getFileExtension(buffer: Buffer): string {
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'pdf';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return 'jpg';
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'png';
    }
    return 'bin';
  }

  private getDefaultTemplates() {
    return [
      {
        name: 'Acordo de Acionistas',
        documentType: 'SHAREHOLDER_AGREEMENT',
        content: `<h1>ACORDO DE ACIONISTAS</h1>
<p>Os abaixo-assinados, na qualidade de acionistas da empresa <strong>{{companyName}}</strong>, CNPJ {{companyCnpj}}, neste ato representada, celebram o presente Acordo de Acionistas nos termos abaixo:</p>

<h2>1. PARTES</h2>
{{#each shareholders}}
<p><strong>{{this.name}}</strong>, inscrito(a) no CPF/CNPJ sob o nº {{this.cpfCnpj}}, titular de {{formatNumber this.shares}} ações.</p>
{{/each}}

<h2>2. DIREITO DE VOTO</h2>
<p>Os acionistas concordam que as decisões societárias serão tomadas por {{votingRights}}.</p>

{{#if transferRestrictions}}
<h2>3. RESTRIÇÕES DE TRANSFERÊNCIA</h2>
<p>As partes concordam que nenhuma transferência de ações poderá ser realizada sem o consentimento prévio e por escrito dos demais acionistas, respeitado o direito de preferência.</p>
{{/if}}

<h2>{{#if transferRestrictions}}4{{else}}3{{/if}}. VIGÊNCIA</h2>
<p>O presente acordo entra em vigor na data de {{formatDate effectiveDate}} e permanecerá em vigor pelo prazo indeterminado.</p>

<h2>{{#if transferRestrictions}}5{{else}}4{{/if}}. FORO</h2>
<p>Fica eleito o foro da comarca da sede da empresa para dirimir quaisquer dúvidas ou controvérsias oriundas deste acordo.</p>

<div class="signature-block">
{{#each shareholders}}
<div class="signature-line">{{this.name}}</div>
{{/each}}
</div>`,
        formSchema: {
          fields: [
            {
              name: 'companyName',
              type: 'text',
              label: 'Nome da Empresa',
              labelEn: 'Company Name',
              required: true,
            },
            {
              name: 'companyCnpj',
              type: 'text',
              label: 'CNPJ',
              labelEn: 'CNPJ',
              required: true,
            },
            {
              name: 'shareholders',
              type: 'array',
              label: 'Acionistas',
              labelEn: 'Shareholders',
              required: true,
              itemSchema: [
                { name: 'name', type: 'text', label: 'Nome', labelEn: 'Name', required: true },
                {
                  name: 'cpfCnpj',
                  type: 'text',
                  label: 'CPF/CNPJ',
                  labelEn: 'CPF/CNPJ',
                  required: true,
                },
                {
                  name: 'shares',
                  type: 'number',
                  label: 'Ações',
                  labelEn: 'Shares',
                  required: true,
                  min: 1,
                },
              ],
            },
            {
              name: 'votingRights',
              type: 'select',
              label: 'Direito de Voto',
              labelEn: 'Voting Rights',
              required: true,
              options: [
                { value: 'pro-rata', label: 'Pro-rata', labelEn: 'Pro-rata' },
                { value: 'maioria simples', label: 'Maioria simples', labelEn: 'Simple majority' },
                { value: 'unanimidade', label: 'Unanimidade', labelEn: 'Unanimous' },
              ],
            },
            {
              name: 'effectiveDate',
              type: 'date',
              label: 'Data de Vigência',
              labelEn: 'Effective Date',
              required: true,
            },
            {
              name: 'transferRestrictions',
              type: 'boolean',
              label: 'Restrições de Transferência',
              labelEn: 'Transfer Restrictions',
              required: false,
              default: true,
            },
          ],
        },
      },
      {
        name: 'Ata de Assembleia',
        documentType: 'MEETING_MINUTES',
        content: `<h1>ATA DA ASSEMBLEIA GERAL</h1>
<h2>{{companyName}}</h2>
<p>CNPJ: {{companyCnpj}}</p>
<p>Data: {{formatDate meetingDate}}</p>
<p>Local: {{meetingLocation}}</p>

<h2>1. CONVOCAÇÃO E QUÓRUM</h2>
<p>A assembleia foi convocada na forma do contrato social/estatuto, estando presentes os seguintes acionistas representando {{quorumPercentage}}% do capital social:</p>
{{#each attendees}}
<p>- {{this.name}} ({{formatNumber this.shares}} ações — {{this.percentage}}%)</p>
{{/each}}

<h2>2. ORDEM DO DIA</h2>
{{#each agendaItems}}
<p>{{@index}}. {{this}}</p>
{{/each}}

<h2>3. DELIBERAÇÕES</h2>
{{{deliberations}}}

<h2>4. ENCERRAMENTO</h2>
<p>Nada mais havendo a ser tratado, foi encerrada a presente assembleia, cuja ata foi lavrada e assinada pelos presentes.</p>

<div class="signature-block">
<div class="signature-line">Presidente da Mesa</div>
<div class="signature-line">Secretário(a)</div>
{{#each attendees}}
<div class="signature-line">{{this.name}}</div>
{{/each}}
</div>`,
        formSchema: {
          fields: [
            {
              name: 'companyName',
              type: 'text',
              label: 'Nome da Empresa',
              labelEn: 'Company Name',
              required: true,
            },
            { name: 'companyCnpj', type: 'text', label: 'CNPJ', labelEn: 'CNPJ', required: true },
            {
              name: 'meetingDate',
              type: 'date',
              label: 'Data da Assembleia',
              labelEn: 'Meeting Date',
              required: true,
            },
            {
              name: 'meetingLocation',
              type: 'text',
              label: 'Local',
              labelEn: 'Location',
              required: true,
            },
            {
              name: 'quorumPercentage',
              type: 'number',
              label: 'Quórum (%)',
              labelEn: 'Quorum (%)',
              required: true,
              min: 0,
              max: 100,
            },
            {
              name: 'attendees',
              type: 'array',
              label: 'Presentes',
              labelEn: 'Attendees',
              required: true,
              itemSchema: [
                { name: 'name', type: 'text', label: 'Nome', labelEn: 'Name', required: true },
                {
                  name: 'shares',
                  type: 'number',
                  label: 'Ações',
                  labelEn: 'Shares',
                  required: true,
                },
                { name: 'percentage', type: 'number', label: '%', labelEn: '%', required: true },
              ],
            },
            {
              name: 'agendaItems',
              type: 'array',
              label: 'Ordem do Dia',
              labelEn: 'Agenda Items',
              required: true,
              itemSchema: [
                { name: 'item', type: 'text', label: 'Item', labelEn: 'Item', required: true },
              ],
            },
            {
              name: 'deliberations',
              type: 'text',
              label: 'Deliberações',
              labelEn: 'Deliberations',
              required: true,
            },
          ],
        },
      },
      {
        name: 'Certificado de Ações',
        documentType: 'SHARE_CERTIFICATE',
        content: `<h1>CERTIFICADO DE AÇÕES</h1>
<p style="text-align: center; font-size: 11pt; color: #6B7280;">Nº {{certificateNumber}}</p>

<h2>EMPRESA</h2>
<p><strong>{{companyName}}</strong></p>
<p>CNPJ: {{companyCnpj}}</p>

<h2>TITULAR</h2>
<p><strong>{{shareholderName}}</strong></p>
<p>CPF/CNPJ: {{shareholderCpfCnpj}}</p>

<h2>AÇÕES</h2>
<table>
<tr><th>Classe</th><th>Quantidade</th><th>Valor Nominal</th><th>Total</th></tr>
<tr>
  <td>{{shareClassName}}</td>
  <td>{{formatNumber shareQuantity}}</td>
  <td>{{formatCurrency pricePerShare}}</td>
  <td>{{formatCurrency totalValue}}</td>
</tr>
</table>

<p>Certificamos que {{shareholderName}} é titular de {{formatNumber shareQuantity}} ações da classe {{shareClassName}} da empresa {{companyName}}, conforme registros da empresa.</p>

<p>Data de emissão: {{formatDate issueDate}}</p>

<div class="signature-block">
<div class="signature-line">Diretor(a) — {{companyName}}</div>
</div>`,
        formSchema: {
          fields: [
            {
              name: 'certificateNumber',
              type: 'text',
              label: 'Número do Certificado',
              labelEn: 'Certificate Number',
              required: true,
            },
            {
              name: 'companyName',
              type: 'text',
              label: 'Nome da Empresa',
              labelEn: 'Company Name',
              required: true,
            },
            { name: 'companyCnpj', type: 'text', label: 'CNPJ', labelEn: 'CNPJ', required: true },
            {
              name: 'shareholderName',
              type: 'text',
              label: 'Nome do Titular',
              labelEn: 'Shareholder Name',
              required: true,
            },
            {
              name: 'shareholderCpfCnpj',
              type: 'text',
              label: 'CPF/CNPJ do Titular',
              labelEn: 'Shareholder CPF/CNPJ',
              required: true,
            },
            {
              name: 'shareClassName',
              type: 'text',
              label: 'Classe de Ações',
              labelEn: 'Share Class',
              required: true,
            },
            {
              name: 'shareQuantity',
              type: 'number',
              label: 'Quantidade',
              labelEn: 'Quantity',
              required: true,
              min: 1,
            },
            {
              name: 'pricePerShare',
              type: 'currency',
              label: 'Valor por Ação',
              labelEn: 'Price per Share',
              required: true,
            },
            {
              name: 'totalValue',
              type: 'currency',
              label: 'Valor Total',
              labelEn: 'Total Value',
              required: true,
            },
            {
              name: 'issueDate',
              type: 'date',
              label: 'Data de Emissão',
              labelEn: 'Issue Date',
              required: true,
            },
          ],
        },
      },
      {
        name: 'Carta de Outorga de Opções',
        documentType: 'OPTION_LETTER',
        content: `<h1>CARTA DE OUTORGA DE OPÇÕES DE COMPRA DE AÇÕES</h1>

<p>Pelo presente instrumento, <strong>{{companyName}}</strong>, CNPJ {{companyCnpj}}, outorga ao beneficiário abaixo identificado opções de compra de ações nos termos do Plano de Opções aprovado pela assembleia geral.</p>

<h2>BENEFICIÁRIO</h2>
<p>Nome: <strong>{{granteeName}}</strong></p>
<p>CPF: {{granteeCpf}}</p>
<p>Cargo: {{granteePosition}}</p>

<h2>CONDIÇÕES DA OUTORGA</h2>
<table>
<tr><th>Item</th><th>Detalhe</th></tr>
<tr><td>Quantidade de opções</td><td>{{formatNumber optionQuantity}}</td></tr>
<tr><td>Preço de exercício</td><td>{{formatCurrency strikePrice}} por ação</td></tr>
<tr><td>Data da outorga</td><td>{{formatDate grantDate}}</td></tr>
<tr><td>Período de cliff</td><td>{{cliffMonths}} meses</td></tr>
<tr><td>Período total de vesting</td><td>{{vestingMonths}} meses</td></tr>
<tr><td>Data de expiração</td><td>{{formatDate expirationDate}}</td></tr>
</table>

<h2>CRONOGRAMA DE VESTING</h2>
<p>Após o período de cliff de {{cliffMonths}} meses a partir da data de outorga, as opções serão adquiridas linearmente ao longo de {{vestingMonths}} meses.</p>

<h2>CONDIÇÕES GERAIS</h2>
<p>Esta outorga está sujeita aos termos e condições do Plano de Opções da empresa e à legislação brasileira aplicável.</p>

<div class="signature-block">
<div class="signature-line">{{companyName}} — Administrador(a)</div>
<div class="signature-line">{{granteeName}} — Beneficiário(a)</div>
</div>`,
        formSchema: {
          fields: [
            {
              name: 'companyName',
              type: 'text',
              label: 'Nome da Empresa',
              labelEn: 'Company Name',
              required: true,
            },
            { name: 'companyCnpj', type: 'text', label: 'CNPJ', labelEn: 'CNPJ', required: true },
            {
              name: 'granteeName',
              type: 'text',
              label: 'Nome do Beneficiário',
              labelEn: 'Grantee Name',
              required: true,
            },
            {
              name: 'granteeCpf',
              type: 'text',
              label: 'CPF do Beneficiário',
              labelEn: 'Grantee CPF',
              required: true,
            },
            {
              name: 'granteePosition',
              type: 'text',
              label: 'Cargo',
              labelEn: 'Position',
              required: true,
            },
            {
              name: 'optionQuantity',
              type: 'number',
              label: 'Quantidade de Opções',
              labelEn: 'Option Quantity',
              required: true,
              min: 1,
            },
            {
              name: 'strikePrice',
              type: 'currency',
              label: 'Preço de Exercício',
              labelEn: 'Strike Price',
              required: true,
            },
            {
              name: 'grantDate',
              type: 'date',
              label: 'Data da Outorga',
              labelEn: 'Grant Date',
              required: true,
            },
            {
              name: 'cliffMonths',
              type: 'number',
              label: 'Cliff (meses)',
              labelEn: 'Cliff (months)',
              required: true,
              min: 0,
            },
            {
              name: 'vestingMonths',
              type: 'number',
              label: 'Vesting (meses)',
              labelEn: 'Vesting (months)',
              required: true,
              min: 1,
            },
            {
              name: 'expirationDate',
              type: 'date',
              label: 'Data de Expiração',
              labelEn: 'Expiration Date',
              required: true,
            },
          ],
        },
      },
      {
        name: 'Acordo de Investimento',
        documentType: 'INVESTMENT_AGREEMENT',
        content: `<h1>ACORDO DE INVESTIMENTO</h1>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas celebram o presente Acordo de Investimento:</p>

<h2>1. PARTES</h2>
<p><strong>EMPRESA:</strong> {{companyName}}, CNPJ {{companyCnpj}}</p>
<p><strong>INVESTIDOR:</strong> {{investorName}}, CPF/CNPJ {{investorCpfCnpj}}</p>

<h2>2. OBJETO</h2>
<p>O investidor se compromete a aportar o valor de {{formatCurrency investmentAmount}} na empresa, em troca de {{formatNumber shareQuantity}} ações da classe {{shareClassName}}.</p>

<h2>3. VALORAÇÃO</h2>
<table>
<tr><th>Item</th><th>Valor</th></tr>
<tr><td>Valoração pré-money</td><td>{{formatCurrency preMoneyValuation}}</td></tr>
<tr><td>Investimento</td><td>{{formatCurrency investmentAmount}}</td></tr>
<tr><td>Valoração pós-money</td><td>{{formatCurrency postMoneyValuation}}</td></tr>
<tr><td>Preço por ação</td><td>{{formatCurrency pricePerShare}}</td></tr>
<tr><td>Participação resultante</td><td>{{ownershipPercentage}}%</td></tr>
</table>

<h2>4. PRAZO</h2>
<p>O aporte deverá ser realizado até {{formatDate paymentDeadline}}.</p>

<h2>5. CONDIÇÕES PRECEDENTES</h2>
<p>O fechamento do investimento está condicionado ao cumprimento das seguintes condições precedentes:</p>
<ul>
{{#each conditions}}
<li>{{this}}</li>
{{/each}}
</ul>

<h2>6. FORO</h2>
<p>Fica eleito o foro da comarca da sede da empresa para dirimir quaisquer controvérsias.</p>

<div class="signature-block">
<div class="signature-line">{{companyName}}</div>
<div class="signature-line">{{investorName}}</div>
</div>`,
        formSchema: {
          fields: [
            {
              name: 'companyName',
              type: 'text',
              label: 'Nome da Empresa',
              labelEn: 'Company Name',
              required: true,
            },
            { name: 'companyCnpj', type: 'text', label: 'CNPJ', labelEn: 'CNPJ', required: true },
            {
              name: 'investorName',
              type: 'text',
              label: 'Nome do Investidor',
              labelEn: 'Investor Name',
              required: true,
            },
            {
              name: 'investorCpfCnpj',
              type: 'text',
              label: 'CPF/CNPJ do Investidor',
              labelEn: 'Investor CPF/CNPJ',
              required: true,
            },
            {
              name: 'investmentAmount',
              type: 'currency',
              label: 'Valor do Investimento',
              labelEn: 'Investment Amount',
              required: true,
            },
            {
              name: 'shareQuantity',
              type: 'number',
              label: 'Quantidade de Ações',
              labelEn: 'Share Quantity',
              required: true,
              min: 1,
            },
            {
              name: 'shareClassName',
              type: 'text',
              label: 'Classe de Ações',
              labelEn: 'Share Class',
              required: true,
            },
            {
              name: 'preMoneyValuation',
              type: 'currency',
              label: 'Valoração Pré-money',
              labelEn: 'Pre-money Valuation',
              required: true,
            },
            {
              name: 'postMoneyValuation',
              type: 'currency',
              label: 'Valoração Pós-money',
              labelEn: 'Post-money Valuation',
              required: true,
            },
            {
              name: 'pricePerShare',
              type: 'currency',
              label: 'Preço por Ação',
              labelEn: 'Price per Share',
              required: true,
            },
            {
              name: 'ownershipPercentage',
              type: 'number',
              label: 'Participação (%)',
              labelEn: 'Ownership (%)',
              required: true,
            },
            {
              name: 'paymentDeadline',
              type: 'date',
              label: 'Prazo para Aporte',
              labelEn: 'Payment Deadline',
              required: true,
            },
            {
              name: 'conditions',
              type: 'array',
              label: 'Condições Precedentes',
              labelEn: 'Conditions Precedent',
              required: false,
              itemSchema: [
                {
                  name: 'condition',
                  type: 'text',
                  label: 'Condição',
                  labelEn: 'Condition',
                  required: true,
                },
              ],
            },
          ],
        },
      },
    ];
  }
}
