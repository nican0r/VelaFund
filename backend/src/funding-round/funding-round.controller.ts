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
import { FundingRoundService } from './funding-round.service';
import { CreateFundingRoundDto } from './dto/create-funding-round.dto';
import { UpdateFundingRoundDto } from './dto/update-funding-round.dto';
import { CreateCommitmentDto } from './dto/create-commitment.dto';
import {
  ListFundingRoundsQueryDto,
  ListCommitmentsQueryDto,
} from './dto/list-funding-rounds-query.dto';
import { UpdateCommitmentPaymentDto } from './dto/update-commitment-payment.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Funding Rounds')
@Controller('api/v1/companies/:companyId/funding-rounds')
export class FundingRoundController {
  constructor(private readonly fundingRoundService: FundingRoundService) {}

  // ========================
  // Funding Round Endpoints
  // ========================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'ROUND_CREATED',
    resourceType: 'FundingRound',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create a new funding round' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Funding round created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Company or share class not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateFundingRoundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fundingRoundService.create(companyId, dto, user.id);
  }

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List funding rounds with pagination and filtering' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of funding rounds' })
  async list(@Param('companyId') companyId: string, @Query() query: ListFundingRoundsQueryDto) {
    const { items, total } = await this.fundingRoundService.findAll(companyId, query);
    return paginate(items, total, query.page, query.limit);
  }

  @Get(':roundId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get funding round detail' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Funding round detail' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  async getOne(@Param('companyId') companyId: string, @Param('roundId') roundId: string) {
    return this.fundingRoundService.findById(companyId, roundId);
  }

  @Put(':roundId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'ROUND_UPDATED',
    resourceType: 'FundingRound',
    resourceIdParam: 'roundId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update funding round (DRAFT/OPEN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Funding round updated' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  @ApiResponse({ status: 422, description: 'Round is not in editable state' })
  async update(
    @Param('companyId') companyId: string,
    @Param('roundId') roundId: string,
    @Body() dto: UpdateFundingRoundDto,
  ) {
    return this.fundingRoundService.update(companyId, roundId, dto);
  }

  @Post(':roundId/open')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'ROUND_OPENED',
    resourceType: 'FundingRound',
    resourceIdParam: 'roundId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Open a DRAFT funding round for commitments' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Funding round opened' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async open(@Param('companyId') companyId: string, @Param('roundId') roundId: string) {
    return this.fundingRoundService.open(companyId, roundId);
  }

  @Post(':roundId/close')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'ROUND_CLOSED',
    resourceType: 'FundingRound',
    resourceIdParam: 'roundId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Close funding round and issue shares' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Funding round closed, shares issued' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  @ApiResponse({
    status: 422,
    description: 'Cannot close — unconfirmed payments or minimum not met',
  })
  async close(@Param('companyId') companyId: string, @Param('roundId') roundId: string) {
    return this.fundingRoundService.close(companyId, roundId);
  }

  @Post(':roundId/cancel')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'ROUND_CANCELLED',
    resourceType: 'FundingRound',
    resourceIdParam: 'roundId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Cancel a funding round' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Funding round cancelled' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  @ApiResponse({ status: 422, description: 'Cannot cancel closed round' })
  async cancel(@Param('companyId') companyId: string, @Param('roundId') roundId: string) {
    return this.fundingRoundService.cancel(companyId, roundId);
  }

  @Get(':roundId/proforma')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get pro-forma cap table for round' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Pro-forma cap table' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  async getProforma(@Param('companyId') companyId: string, @Param('roundId') roundId: string) {
    return this.fundingRoundService.getProforma(companyId, roundId);
  }

  // ========================
  // Commitment Endpoints
  // ========================

  @Post(':roundId/commitments')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMMITMENT_CREATED',
    resourceType: 'RoundCommitment',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Add an investor commitment' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 201, description: 'Commitment created' })
  @ApiResponse({ status: 404, description: 'Round or shareholder not found' })
  @ApiResponse({ status: 409, description: 'Commitment already exists for shareholder' })
  @ApiResponse({ status: 422, description: 'Round not open or hard cap reached' })
  async addCommitment(
    @Param('companyId') companyId: string,
    @Param('roundId') roundId: string,
    @Body() dto: CreateCommitmentDto,
  ) {
    return this.fundingRoundService.addCommitment(companyId, roundId, dto);
  }

  @Get(':roundId/commitments')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List commitments for a funding round' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of commitments' })
  @ApiResponse({ status: 404, description: 'Round not found' })
  async listCommitments(
    @Param('companyId') companyId: string,
    @Param('roundId') roundId: string,
    @Query() query: ListCommitmentsQueryDto,
  ) {
    const { items, total } = await this.fundingRoundService.findCommitments(
      companyId,
      roundId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Put(':roundId/commitments/:commitmentId/payment')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'COMMITMENT_CONFIRMED',
    resourceType: 'RoundCommitment',
    resourceIdParam: 'commitmentId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Update commitment payment status' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiParam({ name: 'commitmentId', description: 'Commitment UUID' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 404, description: 'Round or commitment not found' })
  @ApiResponse({ status: 422, description: 'Invalid payment status transition' })
  async updatePayment(
    @Param('companyId') companyId: string,
    @Param('roundId') roundId: string,
    @Param('commitmentId') commitmentId: string,
    @Body() dto: UpdateCommitmentPaymentDto,
  ) {
    return this.fundingRoundService.updateCommitmentPayment(companyId, roundId, commitmentId, dto);
  }

  @Delete(':roundId/commitments/:commitmentId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @Auditable({
    action: 'COMMITMENT_CANCELLED',
    resourceType: 'RoundCommitment',
    resourceIdParam: 'commitmentId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Cancel a commitment' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'roundId', description: 'Funding round UUID' })
  @ApiParam({ name: 'commitmentId', description: 'Commitment UUID' })
  @ApiResponse({ status: 200, description: 'Commitment cancelled' })
  @ApiResponse({ status: 404, description: 'Round or commitment not found' })
  @ApiResponse({ status: 422, description: 'Round is closed or commitment already cancelled' })
  async cancelCommitment(
    @Param('companyId') companyId: string,
    @Param('roundId') roundId: string,
    @Param('commitmentId') commitmentId: string,
  ) {
    return this.fundingRoundService.cancelCommitment(companyId, roundId, commitmentId);
  }
}
