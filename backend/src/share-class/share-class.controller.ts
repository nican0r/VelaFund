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
import { ShareClassService } from './share-class.service';
import { CreateShareClassDto } from './dto/create-share-class.dto';
import { UpdateShareClassDto } from './dto/update-share-class.dto';
import { ListShareClassesQueryDto } from './dto/list-share-classes-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Share Classes')
@Controller('api/v1/companies/:companyId/share-classes')
export class ShareClassController {
  constructor(private readonly shareClassService: ShareClassService) {}

  /**
   * Create a new share class for a company.
   *
   * Only ADMIN members can create share classes.
   * Company must be ACTIVE. Validates entity type compatibility and preferred share limits.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHARE_CLASS_CREATED',
    resourceType: 'ShareClass',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create a share class' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Share class created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Duplicate class name' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async create(@Param('companyId') companyId: string, @Body() dto: CreateShareClassDto) {
    return this.shareClassService.create(companyId, dto);
  }

  /**
   * List all share classes for a company.
   *
   * ADMIN, FINANCE, LEGAL, and INVESTOR roles can view share classes.
   */
  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List share classes' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of share classes' })
  async list(@Param('companyId') companyId: string, @Query() query: ListShareClassesQueryDto) {
    const { items, total } = await this.shareClassService.findAll(companyId, query);
    return paginate(items, total, query.page, query.limit);
  }

  /**
   * Get a single share class by ID.
   *
   * ADMIN, FINANCE, LEGAL, and INVESTOR roles can view share class details.
   */
  @Get(':id')
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get share class details' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'id', description: 'Share class UUID' })
  @ApiResponse({ status: 200, description: 'Share class details' })
  @ApiResponse({ status: 404, description: 'Share class not found' })
  async getOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.shareClassService.findById(companyId, id);
  }

  /**
   * Update a share class.
   *
   * Only ADMIN members can update share classes.
   * Mutable fields: totalAuthorized (increase only), lockUpPeriodMonths,
   * tagAlongPercentage, rightOfFirstRefusal.
   */
  @Put(':id')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHARE_CLASS_UPDATED',
    resourceType: 'ShareClass',
    resourceIdParam: 'id',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update a share class' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'id', description: 'Share class UUID' })
  @ApiResponse({ status: 200, description: 'Share class updated' })
  @ApiResponse({ status: 404, description: 'Share class not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShareClassDto,
  ) {
    return this.shareClassService.update(companyId, id, dto);
  }

  /**
   * Delete a share class.
   *
   * Only ADMIN members can delete share classes.
   * Only allowed if no shares have been issued (totalIssued = 0).
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHARE_CLASS_DELETED',
    resourceType: 'ShareClass',
    resourceIdParam: 'id',
    captureBeforeState: true,
  })
  @ApiOperation({ summary: 'Delete a share class' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'id', description: 'Share class UUID' })
  @ApiResponse({ status: 204, description: 'Share class deleted' })
  @ApiResponse({ status: 404, description: 'Share class not found' })
  @ApiResponse({ status: 422, description: 'Share class has issued shares' })
  async delete(@Param('companyId') companyId: string, @Param('id') id: string) {
    await this.shareClassService.delete(companyId, id);
  }
}
