import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CompanyProfileService } from './company-profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateMetricsDto } from './dto/update-metrics.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateSlugDto } from './dto/update-slug.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@Controller('api/v1/companies/:companyId/profile')
export class CompanyProfileController {
  constructor(private readonly profileService: CompanyProfileService) {}

  // ─── 1. CREATE PROFILE ──────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_CREATED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async create(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profileService.create(companyId, dto, user.id);
  }

  // ─── 2. GET PROFILE ─────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async findByCompanyId(@Param('companyId') companyId: string) {
    return this.profileService.findByCompanyId(companyId);
  }

  // ─── 3. UPDATE PROFILE ──────────────────────────────────────────────

  @Put()
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_UPDATED',
    resourceType: 'CompanyProfile',
    captureBeforeState: true,
    captureAfterState: true,
  })
  async update(@Param('companyId') companyId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.update(companyId, dto);
  }

  // ─── 4. UPDATE SLUG ────────────────────────────────────────────────

  @Put('slug')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_SLUG_UPDATED',
    resourceType: 'CompanyProfile',
    captureBeforeState: true,
    captureAfterState: true,
  })
  async updateSlug(@Param('companyId') companyId: string, @Body() dto: UpdateSlugDto) {
    return this.profileService.updateSlug(companyId, dto.slug);
  }

  // ─── 5. PUBLISH ─────────────────────────────────────────────────────

  @Post('publish')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_PUBLISHED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async publish(@Param('companyId') companyId: string) {
    return this.profileService.publish(companyId);
  }

  // ─── 6. UNPUBLISH ──────────────────────────────────────────────────

  @Post('unpublish')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_UNPUBLISHED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async unpublish(@Param('companyId') companyId: string) {
    return this.profileService.unpublish(companyId);
  }

  // ─── 7. ARCHIVE ─────────────────────────────────────────────────────

  @Post('archive')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_ARCHIVED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async archive(@Param('companyId') companyId: string) {
    return this.profileService.archive(companyId);
  }

  // ─── 8. REPLACE METRICS ────────────────────────────────────────────

  @Put('metrics')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_METRICS_UPDATED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async replaceMetrics(@Param('companyId') companyId: string, @Body() dto: UpdateMetricsDto) {
    return this.profileService.replaceMetrics(companyId, dto);
  }

  // ─── 9. REPLACE TEAM MEMBERS ───────────────────────────────────────

  @Put('team')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'PROFILE_TEAM_UPDATED',
    resourceType: 'CompanyProfile',
    captureAfterState: true,
  })
  async replaceTeamMembers(@Param('companyId') companyId: string, @Body() dto: UpdateTeamDto) {
    return this.profileService.replaceTeamMembers(companyId, dto);
  }

  // ─── 10. UPLOAD TEAM PHOTO ─────────────────────────────────────────

  @Post('team/photo')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ upload: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTeamPhoto(
    @Param('companyId') companyId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2 MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.profileService.uploadTeamPhoto(companyId, file);
  }

  // ─── 12. ANALYTICS ─────────────────────────────────────────────────

  @Get('analytics')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getAnalytics(
    @Param('companyId') companyId: string,
    @Query('period') period?: '7d' | '30d' | '90d',
  ) {
    return this.profileService.getAnalytics(companyId, period);
  }
}
