import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/helpers/paginate';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Companies')
@Controller('api/v1/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /**
   * Create a new company.
   *
   * Any authenticated user can create a company.
   * The creator is automatically assigned as ADMIN member.
   * Company starts in DRAFT status (async CNPJ validation is a future step).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMPANY_CREATED',
    resourceType: 'Company',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'Company created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'CNPJ already registered' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.companyService.create(dto, userId);
  }

  /**
   * List all companies the authenticated user is a member of.
   *
   * Returns company summary with user's role and member count.
   * Does not require :companyId since this is user-scoped.
   */
  @Get()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List user companies' })
  @ApiResponse({ status: 200, description: 'Paginated list of companies' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const { items, total } = await this.companyService.findAllForUser(
      userId,
      pagination,
      { status, sort },
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  /**
   * Get company details.
   *
   * Any active member of the company can view its details.
   * RolesGuard verifies membership and attaches companyMember to request.
   */
  @Get(':companyId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get company details' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 404, description: 'Company not found or not a member' })
  async getOne(@Param('companyId') companyId: string) {
    return this.companyService.findById(companyId);
  }

  /**
   * Update company details.
   *
   * Only ADMIN members can update company details.
   * Cannot update DISSOLVED companies. entityType and CNPJ are immutable.
   */
  @Put(':companyId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMPANY_UPDATED',
    resourceType: 'Company',
    resourceIdParam: 'companyId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update company details' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company updated' })
  @ApiResponse({ status: 403, description: 'Not an ADMIN' })
  @ApiResponse({ status: 404, description: 'Company not found or not a member' })
  @ApiResponse({ status: 422, description: 'Cannot update dissolved company' })
  async update(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(companyId, dto);
  }

  /**
   * Update company status (activate / deactivate).
   *
   * Valid transitions: ACTIVE → INACTIVE, INACTIVE → ACTIVE.
   * DRAFT → ACTIVE is handled automatically by CNPJ validation (future).
   * DISSOLVED cannot transition back.
   */
  @Patch(':companyId/status')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMPANY_STATUS_CHANGED',
    resourceType: 'Company',
    resourceIdParam: 'companyId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update company status (activate/deactivate)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async updateStatus(
    @Param('companyId') companyId: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE',
  ) {
    return this.companyService.updateStatus(companyId, status);
  }

  /**
   * Dissolve (archive) a company.
   *
   * Permanent, irreversible action. Only ADMIN can dissolve.
   * Prerequisites: no active shareholders, no active funding rounds.
   */
  @Delete(':companyId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMPANY_STATUS_CHANGED',
    resourceType: 'Company',
    resourceIdParam: 'companyId',
    captureBeforeState: true,
  })
  @ApiOperation({ summary: 'Dissolve (archive) a company' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 204, description: 'Company dissolved' })
  @ApiResponse({ status: 422, description: 'Cannot dissolve — active shareholders or rounds' })
  async dissolve(@Param('companyId') companyId: string) {
    await this.companyService.dissolve(companyId);
  }
}
