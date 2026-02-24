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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { paginate } from '../common/helpers/paginate';
import { ConvertibleService } from './convertible.service';
import { CreateConvertibleDto } from './dto/create-convertible.dto';
import { UpdateConvertibleDto } from './dto/update-convertible.dto';
import { ListConvertiblesQueryDto } from './dto/list-convertibles-query.dto';
import { RedeemConvertibleDto } from './dto/redeem-convertible.dto';
import { CancelConvertibleDto } from './dto/cancel-convertible.dto';
import { ConvertConvertibleDto } from './dto/convert-convertible.dto';

interface AuthenticatedUser {
  id: string;
  email?: string;
}

@ApiTags('Convertible Instruments')
@Controller('api/v1/companies/:companyId/convertibles')
export class ConvertibleController {
  constructor(private readonly convertibleService: ConvertibleService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Create a new convertible instrument' })
  @ApiResponse({ status: 201, description: 'Convertible created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Company or shareholder not found' })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateConvertibleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.convertibleService.create(companyId, dto, user.id);
  }

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List convertible instruments' })
  @ApiResponse({ status: 200, description: 'Paginated list with summary' })
  async list(
    @Param('companyId') companyId: string,
    @Query() query: ListConvertiblesQueryDto,
  ) {
    const { items, total, summary } =
      await this.convertibleService.findAll(companyId, query);
    const result = paginate(items, total, query.page, query.limit);
    return { ...result, meta: { ...result.meta, summary } };
  }

  @Get(':convertibleId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get convertible instrument details' })
  @ApiResponse({ status: 200, description: 'Convertible details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
  ) {
    return this.convertibleService.findById(companyId, convertibleId);
  }

  @Get(':convertibleId/interest')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get interest calculation breakdown' })
  @ApiResponse({ status: 200, description: 'Interest breakdown' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getInterest(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
  ) {
    return this.convertibleService.getInterestBreakdown(
      companyId,
      convertibleId,
    );
  }

  @Get(':convertibleId/scenarios')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Model conversion scenarios at hypothetical valuations' })
  @ApiResponse({ status: 200, description: 'Conversion scenarios' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getScenarios(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
    @Query('valuations') valuations?: string,
  ) {
    return this.convertibleService.getConversionScenarios(
      companyId,
      convertibleId,
      valuations,
    );
  }

  @Put(':convertibleId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Update an OUTSTANDING convertible instrument' })
  @ApiResponse({ status: 200, description: 'Updated convertible' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async update(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
    @Body() dto: UpdateConvertibleDto,
  ) {
    return this.convertibleService.update(companyId, convertibleId, dto);
  }

  @Post(':convertibleId/redeem')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Redeem a convertible (investor buyback)' })
  @ApiResponse({ status: 200, description: 'Redeemed convertible' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async redeem(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
    @Body() dto: RedeemConvertibleDto,
  ) {
    return this.convertibleService.redeem(companyId, convertibleId, dto);
  }

  @Post(':convertibleId/cancel')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Cancel a convertible by mutual agreement' })
  @ApiResponse({ status: 200, description: 'Cancelled convertible' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async cancel(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
    @Body() dto: CancelConvertibleDto,
  ) {
    return this.convertibleService.cancel(companyId, convertibleId, dto);
  }

  @Post(':convertibleId/convert')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Execute conversion of convertible to equity' })
  @ApiResponse({ status: 200, description: 'Conversion executed' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Already converted' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async convert(
    @Param('companyId') companyId: string,
    @Param('convertibleId') convertibleId: string,
    @Body() dto: ConvertConvertibleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.convertibleService.convert(
      companyId,
      convertibleId,
      dto,
      user.id,
    );
  }
}
