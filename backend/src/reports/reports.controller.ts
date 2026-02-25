import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { OwnershipQueryDto } from './dto/ownership-query.dto';
import { DilutionQueryDto } from './dto/dilution-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { DueDiligenceQueryDto } from './dto/due-diligence-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

interface AuthenticatedUser {
  id: string;
  privyUserId: string;
  email: string;
  walletAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  kycStatus: string;
  locale: string;
}

@Controller('api/v1/companies/:companyId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/companies/:companyId/reports/ownership
   * Returns current ownership breakdown.
   */
  @Get('ownership')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getOwnershipReport(
    @Param('companyId') companyId: string,
    @Query() query: OwnershipQueryDto,
  ) {
    return this.reportsService.getOwnershipReport(companyId, query);
  }

  /**
   * GET /api/v1/companies/:companyId/reports/dilution
   * Returns dilution analysis data over time.
   */
  @Get('dilution')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getDilutionReport(
    @Param('companyId') companyId: string,
    @Query() query: DilutionQueryDto,
  ) {
    return this.reportsService.getDilutionReport(companyId, query);
  }

  /**
   * GET /api/v1/companies/:companyId/reports/cap-table/export
   * Queues or synchronously exports cap table in requested format.
   */
  @Get('cap-table/export')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable({
    action: 'CAP_TABLE_EXPORTED',
    resourceType: 'ExportJob',
    captureAfterState: true,
  })
  async exportCapTable(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportQueryDto,
  ) {
    return this.reportsService.exportCapTable(
      companyId,
      user.id,
      query.format || 'pdf',
      query.snapshotDate,
    );
  }

  /**
   * GET /api/v1/companies/:companyId/reports/cap-table/export/:jobId
   * Poll for export job status.
   */
  @Get('cap-table/export/:jobId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getExportStatus(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.reportsService.getExportJobStatus(companyId, jobId);
  }

  /**
   * GET /api/v1/companies/:companyId/reports/due-diligence
   * Queues due diligence package generation (always async).
   */
  @Get('due-diligence')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable({
    action: 'DUE_DILIGENCE_GENERATED',
    resourceType: 'ExportJob',
    captureAfterState: true,
  })
  async generateDueDiligence(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DueDiligenceQueryDto,
  ) {
    return this.reportsService.generateDueDiligence(
      companyId,
      user.id,
      query.dateFrom,
      query.dateTo,
    );
  }

  /**
   * GET /api/v1/companies/:companyId/reports/due-diligence/:jobId
   * Poll for due diligence package status.
   */
  @Get('due-diligence/:jobId')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getDueDiligenceStatus(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.reportsService.getExportJobStatus(companyId, jobId);
  }
}
