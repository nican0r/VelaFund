import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ShareholderService } from './shareholder.service';
import { CreateShareholderDto } from './dto/create-shareholder.dto';
import { UpdateShareholderDto } from './dto/update-shareholder.dto';
import { ListShareholdersQueryDto } from './dto/list-shareholders-query.dto';
import { SetBeneficialOwnersDto } from './dto/set-beneficial-owners.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Shareholders')
@Controller('api/v1/companies/:companyId/shareholders')
export class ShareholderController {
  constructor(private readonly shareholderService: ShareholderService) {}

  /**
   * Create a new shareholder for a company.
   *
   * Only ADMIN members can create shareholders.
   * Company must be ACTIVE. Validates CPF/CNPJ checksum and uniqueness per company.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHAREHOLDER_CREATED',
    resourceType: 'Shareholder',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create a shareholder' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Shareholder created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Duplicate CPF/CNPJ' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateShareholderDto,
  ) {
    return this.shareholderService.create(companyId, dto);
  }

  /**
   * List all shareholders for a company.
   *
   * ADMIN, FINANCE, and LEGAL roles can view shareholders.
   * Supports filtering by status, type, isForeign, and search by name/email.
   */
  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List shareholders' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of shareholders' })
  async list(
    @Param('companyId') companyId: string,
    @Query() query: ListShareholdersQueryDto,
  ) {
    const { items, total } = await this.shareholderService.findAll(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  /**
   * List foreign shareholders for a company with summary statistics.
   *
   * ADMIN and LEGAL roles can view foreign shareholder data.
   * NOTE: This route MUST be declared before /:shareholderId to avoid path conflicts.
   */
  @Get('foreign')
  @Roles('ADMIN', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List foreign shareholders' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Foreign shareholders with summary' })
  async listForeign(@Param('companyId') companyId: string) {
    return this.shareholderService.findForeignShareholders(companyId);
  }

  /**
   * Get a single shareholder by ID.
   *
   * ADMIN, FINANCE, and LEGAL roles can view shareholder details.
   * Includes ownership breakdown (shareholdings) and beneficial owners.
   */
  @Get(':shareholderId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get shareholder details' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'shareholderId', description: 'Shareholder UUID' })
  @ApiResponse({ status: 200, description: 'Shareholder details' })
  @ApiResponse({ status: 404, description: 'Shareholder not found' })
  async getOne(
    @Param('companyId') companyId: string,
    @Param('shareholderId') shareholderId: string,
  ) {
    return this.shareholderService.findById(companyId, shareholderId);
  }

  /**
   * Update a shareholder.
   *
   * Only ADMIN members can update shareholders.
   * Immutable fields: name, cpfCnpj, type, walletAddress.
   * Changing taxResidency recalculates isForeign.
   */
  @Put(':shareholderId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHAREHOLDER_UPDATED',
    resourceType: 'Shareholder',
    resourceIdParam: 'shareholderId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update a shareholder' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'shareholderId', description: 'Shareholder UUID' })
  @ApiResponse({ status: 200, description: 'Shareholder updated' })
  @ApiResponse({ status: 404, description: 'Shareholder not found' })
  async update(
    @Param('companyId') companyId: string,
    @Param('shareholderId') shareholderId: string,
    @Body() dto: UpdateShareholderDto,
  ) {
    return this.shareholderService.update(companyId, shareholderId, dto);
  }

  /**
   * Delete or inactivate a shareholder.
   *
   * Only ADMIN members can remove shareholders.
   * If shareholder has holdings or transaction history, sets status to INACTIVE.
   * If no holdings/transactions, performs hard delete.
   */
  @Delete(':shareholderId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHAREHOLDER_DELETED',
    resourceType: 'Shareholder',
    resourceIdParam: 'shareholderId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Delete or inactivate a shareholder' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'shareholderId', description: 'Shareholder UUID' })
  @ApiResponse({ status: 200, description: 'Shareholder deleted or inactivated' })
  @ApiResponse({ status: 404, description: 'Shareholder not found' })
  async remove(
    @Param('companyId') companyId: string,
    @Param('shareholderId') shareholderId: string,
  ) {
    return this.shareholderService.remove(companyId, shareholderId);
  }

  /**
   * Set beneficial owners for a corporate shareholder.
   *
   * Only ADMIN members can manage beneficial owners.
   * Replaces all existing beneficial owners for the shareholder.
   * Validates: shareholder must be CORPORATE, percentages <= 100%, at least one >= 25%.
   */
  @Post(':shareholderId/beneficial-owners')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHAREHOLDER_UPDATED',
    resourceType: 'Shareholder',
    resourceIdParam: 'shareholderId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Set beneficial owners for a corporate shareholder' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'shareholderId', description: 'Shareholder UUID' })
  @ApiResponse({ status: 200, description: 'Beneficial owners set' })
  @ApiResponse({ status: 404, description: 'Shareholder not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async setBeneficialOwners(
    @Param('companyId') companyId: string,
    @Param('shareholderId') shareholderId: string,
    @Body() dto: SetBeneficialOwnersDto,
  ) {
    return this.shareholderService.setBeneficialOwners(
      companyId,
      shareholderId,
      dto,
    );
  }
}
