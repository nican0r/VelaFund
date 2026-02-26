import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CapTableService } from './cap-table.service';
import { CapTableQueryDto } from './dto/cap-table-query.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { SnapshotHistoryQueryDto } from './dto/snapshot-history-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Cap Table')
@Controller('api/v1/companies/:companyId/cap-table')
export class CapTableController {
  constructor(private readonly capTableService: CapTableService) {}

  /**
   * Get the current cap table for a company.
   *
   * ADMIN, FINANCE, and LEGAL roles can view the cap table.
   * Supports filtering by share class and view mode (current, fully-diluted, authorized).
   */
  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get current cap table' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiQuery({ name: 'view', required: false, enum: ['current', 'fully-diluted', 'authorized'] })
  @ApiQuery({ name: 'shareClassId', required: false, description: 'Filter by share class UUID' })
  @ApiResponse({ status: 200, description: 'Current cap table data' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCurrentCapTable(
    @Param('companyId') companyId: string,
    @Query() query: CapTableQueryDto,
  ) {
    if (query.view === 'fully-diluted') {
      return this.capTableService.getFullyDilutedCapTable(companyId);
    }
    return this.capTableService.getCurrentCapTable(companyId, query);
  }

  /**
   * Get fully-diluted cap table including all outstanding options.
   *
   * ADMIN, FINANCE, and LEGAL roles can view the fully-diluted cap table.
   */
  @Get('fully-diluted')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get fully-diluted cap table' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Fully-diluted cap table data' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getFullyDilutedCapTable(@Param('companyId') companyId: string) {
    return this.capTableService.getFullyDilutedCapTable(companyId);
  }

  /**
   * Get a point-in-time cap table snapshot.
   *
   * ADMIN, FINANCE, and LEGAL roles can view snapshots.
   * The `date` query parameter finds the closest snapshot on or before the specified date.
   */
  @Get('snapshot')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get cap table snapshot by date' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiQuery({ name: 'date', required: true, description: 'ISO 8601 date (e.g., 2026-01-31)' })
  @ApiResponse({ status: 200, description: 'Cap table snapshot data' })
  @ApiResponse({ status: 404, description: 'Snapshot not found' })
  async getSnapshot(@Param('companyId') companyId: string, @Query('date') date: string) {
    return this.capTableService.getSnapshot(companyId, date);
  }

  /**
   * Get cap table snapshot history.
   *
   * ADMIN, FINANCE, and LEGAL roles can view snapshot history.
   * Returns a paginated list of all snapshots for the company.
   */
  @Get('history')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get cap table snapshot history' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of snapshots' })
  async getHistory(@Param('companyId') companyId: string, @Query() query: SnapshotHistoryQueryDto) {
    const { items, total } = await this.capTableService.getSnapshotHistory(companyId, query);
    return paginate(items, total, query.page, query.limit);
  }

  /**
   * Export cap table in OCT (Open Cap Table) JSON format.
   *
   * Only ADMIN and FINANCE roles can export the cap table.
   * Produces a JSON document conforming to OCT/OCF standard version 1.0.0.
   */
  @Get('export/oct')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @Auditable({
    action: 'CAP_TABLE_EXPORTED',
    resourceType: 'CapTableSnapshot',
  })
  @ApiOperation({ summary: 'Export cap table in OCT format' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'OCT-formatted cap table JSON' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async exportOct(@Param('companyId') companyId: string) {
    return this.capTableService.exportOct(companyId);
  }

  /**
   * Create a manual cap table snapshot.
   *
   * Only ADMIN and FINANCE roles can create snapshots.
   * Company must be ACTIVE. Snapshot date must not be in the future.
   */
  @Post('snapshot')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'CAP_TABLE_SNAPSHOT_CREATED',
    resourceType: 'CapTableSnapshot',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create manual cap table snapshot' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Snapshot created' })
  @ApiResponse({ status: 400, description: 'Invalid input or future date' })
  @ApiResponse({ status: 422, description: 'Company not active' })
  async createSnapshot(@Param('companyId') companyId: string, @Body() dto: CreateSnapshotDto) {
    return this.capTableService.createSnapshot(companyId, dto);
  }
}
