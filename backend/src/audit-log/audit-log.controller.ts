import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { VerifyHashChainDto } from './dto/verify-hash-chain.dto';
import { paginate } from '../common/helpers/paginate';

@ApiTags('Audit Logs')
@Controller('api/v1/companies/:companyId/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List audit logs for a company' })
  @ApiParam({ name: 'companyId', type: 'string', format: 'uuid' })
  async list(@Param('companyId') companyId: string, @Query() dto: ListAuditLogsDto) {
    const { items, total } = await this.auditLogService.findAll(companyId, dto);

    // Log that audit logs were viewed
    await this.auditLogService.log({
      actorType: 'USER',
      action: 'AUDIT_LOG_VIEWED',
      resourceType: 'AuditLog',
      companyId,
    });

    return paginate(items, total, dto.page, dto.limit);
  }

  @Get('verify')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify hash chain integrity' })
  @ApiParam({ name: 'companyId', type: 'string', format: 'uuid' })
  async verifyHashChain(@Param('companyId') companyId: string, @Query() dto: VerifyHashChainDto) {
    const result = await this.auditLogService.verifyHashChain(dto.dateFrom, dto.dateTo);

    // Log that hash chain was verified
    await this.auditLogService.log({
      actorType: 'USER',
      action: 'AUDIT_LOG_INTEGRITY_VERIFIED',
      resourceType: 'AuditHashChain',
      companyId,
      metadata: {
        dateFrom: dto.dateFrom || null,
        dateTo: dto.dateTo || null,
      },
    });

    return result;
  }

  @Get(':id')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit log detail' })
  @ApiParam({ name: 'companyId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getById(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.auditLogService.findById(companyId, id);
  }
}
