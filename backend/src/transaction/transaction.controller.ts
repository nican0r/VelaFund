import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Auditable } from '../audit-log/decorators/auditable.decorator';

@ApiTags('Transactions')
@Controller('api/v1/companies/:companyId/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'TRANSACTION_SUBMITTED',
    resourceType: 'Transaction',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Company, shareholder, or share class not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionService.create(companyId, dto, user.id);
  }

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List transactions with filtering and pagination' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async list(@Param('companyId') companyId: string, @Query() query: ListTransactionsQueryDto) {
    const { items, total } = await this.transactionService.findAll(companyId, query);
    return paginate(items, total, query.page, query.limit);
  }

  @Get(':transactionId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get transaction detail' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction detail with blockchain info' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getOne(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.findById(companyId, transactionId);
  }

  @Post(':transactionId/submit')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'TRANSACTION_SUBMITTED',
    resourceType: 'Transaction',
    resourceIdParam: 'transactionId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Submit a DRAFT transaction for processing' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction submitted' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async submit(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.submit(companyId, transactionId);
  }

  @Post(':transactionId/approve')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'TRANSACTION_APPROVED',
    resourceType: 'Transaction',
    resourceIdParam: 'transactionId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Approve a pending transaction' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction approved' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async approve(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionService.approve(companyId, transactionId, user.id);
  }

  @Post(':transactionId/confirm')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'SHARES_ISSUED',
    resourceType: 'Transaction',
    resourceIdParam: 'transactionId',
    captureBeforeState: true,
    captureAfterState: true,
  })
  @ApiOperation({
    summary: 'Confirm a submitted transaction (execute cap table mutation)',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction confirmed, cap table updated' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition or insufficient shares' })
  async confirm(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.confirm(companyId, transactionId);
  }

  @Post(':transactionId/cancel')
  @Roles('ADMIN', 'FINANCE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @Auditable({
    action: 'TRANSACTION_CANCELLED',
    resourceType: 'Transaction',
    resourceIdParam: 'transactionId',
    captureAfterState: true,
  })
  @ApiOperation({ summary: 'Cancel a transaction' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction cancelled' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 422, description: 'Cannot cancel confirmed transaction' })
  async cancel(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionService.cancel(companyId, transactionId, user.id);
  }
}
