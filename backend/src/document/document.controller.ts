import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Documents')
@Controller('api/v1/companies/:companyId')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ─── TEMPLATE ENDPOINTS ────────────────────────────────────────────

  @Get('document-templates')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List document templates' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Template list' })
  async listTemplates(
    @Param('companyId') companyId: string,
    @Query() query: ListTemplatesQueryDto,
  ) {
    const { items, total } = await this.documentService.findAllTemplates(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Get('document-templates/:templateId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get document template detail' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template detail' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(
    @Param('companyId') companyId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.documentService.findTemplateById(companyId, templateId);
  }

  // ─── DOCUMENT ENDPOINTS ────────────────────────────────────────────

  @Get('documents')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List documents' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Document list' })
  async listDocuments(
    @Param('companyId') companyId: string,
    @Query() query: ListDocumentsQueryDto,
  ) {
    const { items, total } = await this.documentService.findAllDocuments(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Get('documents/:documentId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document detail' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.findDocumentById(companyId, documentId);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'DOCUMENT_GENERATED',
    resourceType: 'Document',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Generate a document from template' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Document generated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 422, description: 'Generation failed or incomplete form' })
  async createDocument(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentService.createAndGenerate(companyId, user.id, dto);
  }

  @Post('documents/draft')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'DOCUMENT_DRAFT_CREATED',
    resourceType: 'Document',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Save document as draft' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Draft saved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async createDraft(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentService.createDraft(companyId, user.id, dto);
  }

  @Put('documents/:documentId')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'DOCUMENT_UPDATED',
    resourceType: 'Document',
    resourceIdParam: 'documentId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update a draft document' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Draft updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 422, description: 'Document not in DRAFT status' })
  async updateDraft(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.documentService.updateDraft(companyId, documentId, dto);
  }

  @Post('documents/:documentId/generate')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'DOCUMENT_GENERATED',
    resourceType: 'Document',
    resourceIdParam: 'documentId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Generate PDF from draft document' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'PDF generated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 422, description: 'Not a draft or incomplete form' })
  async generateFromDraft(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.generateFromDraft(companyId, documentId);
  }

  @Get('documents/:documentId/preview')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get document HTML preview' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'HTML preview' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getPreview(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const html = await this.documentService.getPreviewHtml(
      companyId,
      documentId,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('documents/:documentId/download')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get document download URL' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Download URL' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 422, description: 'Document not generated' })
  async getDownload(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.getDownloadUrl(companyId, documentId);
  }

  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ upload: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file'))
  @Auditable({
    action: 'DOCUMENT_UPLOADED',
    resourceType: 'Document',
    captureAfterState: true,
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 422, description: 'Invalid file type or too large' })
  async uploadDocument(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('title') title: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.documentService.uploadDocument(
      companyId,
      user.id,
      title,
      file,
    );
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'DOCUMENT_DELETED',
    resourceType: 'Document',
    resourceIdParam: 'documentId',
    captureBeforeState: true,
  })
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 422, description: 'Document has signatures' })
  async deleteDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.documentService.deleteDocument(companyId, documentId);
  }
}
