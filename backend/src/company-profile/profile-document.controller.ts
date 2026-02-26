import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { DocumentCategory } from '@prisma/client';
import { ProfileDocumentService } from './profile-document.service';
import { CompanyProfileService } from './company-profile.service';
import { ReorderDocumentsDto } from './dto/reorder-documents.dto';
import { BusinessRuleException } from '../common/filters/app-exception';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@Controller('api/v1/companies/:companyId/profile/documents')
export class ProfileDocumentController {
  constructor(private readonly documentService: ProfileDocumentService) {}

  // ─── 1. LIST DOCUMENTS ───────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async list(
    @Param('companyId') companyId: string,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.documentService.findAll(companyId, category);
  }

  // ─── 2. UPLOAD DOCUMENT ──────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ upload: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @Auditable({
    action: 'PROFILE_DOCUMENT_UPLOADED',
    resourceType: 'ProfileDocument',
    captureAfterState: true,
  })
  async upload(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: DocumentCategory,
    @Body('name') name?: string,
  ) {
    if (!file) {
      throw new BusinessRuleException(
        'PROFILE_DOC_FILE_REQUIRED',
        'errors.profile.docFileRequired',
      );
    }
    return this.documentService.upload(companyId, user.id, file, category, name);
  }

  // ─── 3. DELETE DOCUMENT ──────────────────────────────────────────────

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_DOCUMENT_DELETED',
    resourceType: 'ProfileDocument',
    resourceIdParam: 'documentId',
    captureBeforeState: true,
  })
  async delete(@Param('companyId') companyId: string, @Param('documentId') documentId: string) {
    await this.documentService.delete(companyId, documentId);
  }

  // ─── 4. REORDER DOCUMENTS ───────────────────────────────────────────

  @Put('order')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  async reorder(@Param('companyId') companyId: string, @Body() dto: ReorderDocumentsDto) {
    return this.documentService.reorder(companyId, dto.documents);
  }

  // ─── 5. DOWNLOAD URL (AUTHENTICATED) ────────────────────────────────

  @Get(':documentId/download')
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async download(@Param('companyId') companyId: string, @Param('documentId') documentId: string) {
    return this.documentService.getDownloadUrl(companyId, documentId);
  }
}

/**
 * Public controller for document downloads on shared profile links.
 * Separated from authenticated endpoints for clean routing.
 */
@Controller('api/v1/profiles')
export class PublicDocumentController {
  constructor(
    private readonly documentService: ProfileDocumentService,
    private readonly profileService: CompanyProfileService,
  ) {}

  // ─── 6. PUBLIC DOCUMENT DOWNLOAD ─────────────────────────────────────

  @Get(':slug/documents/:documentId/download')
  @Public()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async downloadPublicDocument(
    @Param('slug') slug: string,
    @Param('documentId') documentId: string,
    @Query('password') password?: string,
    @Query('email') email?: string,
    @Req() req?: Request,
  ) {
    // Validate profile access (password/email gate) before serving document
    await this.profileService.getPublicProfile(
      slug,
      password,
      email,
      req?.ip,
      req?.headers['user-agent'],
      (req?.headers['referer'] || req?.headers['referrer']) as string | undefined,
    );

    const viewerIp = req?.ip;
    return this.documentService.getPublicDownloadUrl(slug, documentId, email, viewerIp);
  }
}
