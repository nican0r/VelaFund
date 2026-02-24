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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OptionPlanService } from './option-plan.service';
import { CreateOptionPlanDto } from './dto/create-option-plan.dto';
import { UpdateOptionPlanDto } from './dto/update-option-plan.dto';
import { CreateOptionGrantDto } from './dto/create-option-grant.dto';
import {
  CreateExerciseRequestDto,
  ConfirmExercisePaymentDto,
} from './dto/create-exercise-request.dto';
import {
  ListOptionPlansQueryDto,
  ListOptionGrantsQueryDto,
} from './dto/list-option-plans-query.dto';
import { ListExerciseRequestsQueryDto } from './dto/list-exercise-requests-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Option Plans')
@Controller('api/v1/companies/:companyId')
export class OptionPlanController {
  constructor(private readonly optionPlanService: OptionPlanService) {}

  // ========================
  // Option Plan Endpoints
  // ========================

  @Post('option-plans')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Create a new option plan' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Option plan created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Company or share class not found' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async createPlan(
    @Param('companyId') companyId: string,
    @Body() dto: CreateOptionPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.optionPlanService.createPlan(companyId, dto, user.id);
  }

  @Get('option-plans')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List option plans with pagination and filtering' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of option plans' })
  async listPlans(
    @Param('companyId') companyId: string,
    @Query() query: ListOptionPlansQueryDto,
  ) {
    const { items, total } = await this.optionPlanService.findAllPlans(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Get('option-plans/:planId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get option plan detail with grant stats' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'planId', description: 'Option plan UUID' })
  @ApiResponse({ status: 200, description: 'Option plan detail' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlan(
    @Param('companyId') companyId: string,
    @Param('planId') planId: string,
  ) {
    return this.optionPlanService.findPlanById(companyId, planId);
  }

  @Put('option-plans/:planId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Update option plan (ACTIVE only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'planId', description: 'Option plan UUID' })
  @ApiResponse({ status: 200, description: 'Option plan updated' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 422, description: 'Plan is closed' })
  async updatePlan(
    @Param('companyId') companyId: string,
    @Param('planId') planId: string,
    @Body() dto: UpdateOptionPlanDto,
  ) {
    return this.optionPlanService.updatePlan(companyId, planId, dto);
  }

  @Post('option-plans/:planId/close')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Close an option plan (no new grants allowed)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'planId', description: 'Option plan UUID' })
  @ApiResponse({ status: 200, description: 'Option plan closed' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 422, description: 'Plan already closed' })
  async closePlan(
    @Param('companyId') companyId: string,
    @Param('planId') planId: string,
  ) {
    return this.optionPlanService.closePlan(companyId, planId);
  }

  // ========================
  // Option Grant Endpoints
  // ========================

  @Post('option-grants')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Grant options to an employee' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Option grant created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Plan or shareholder not found' })
  @ApiResponse({ status: 422, description: 'Plan exhausted or closed' })
  async createGrant(
    @Param('companyId') companyId: string,
    @Body() dto: CreateOptionGrantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.optionPlanService.createGrant(companyId, dto, user.id);
  }

  @Get('option-grants')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List option grants with pagination and filtering' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of option grants' })
  async listGrants(
    @Param('companyId') companyId: string,
    @Query() query: ListOptionGrantsQueryDto,
  ) {
    const { items, total } = await this.optionPlanService.findAllGrants(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Get('option-grants/:grantId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get option grant detail with vesting status' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'grantId', description: 'Option grant UUID' })
  @ApiResponse({ status: 200, description: 'Option grant detail with vesting' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  async getGrant(
    @Param('companyId') companyId: string,
    @Param('grantId') grantId: string,
  ) {
    return this.optionPlanService.findGrantById(companyId, grantId);
  }

  @Get('option-grants/:grantId/vesting')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get detailed vesting schedule for a grant' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'grantId', description: 'Option grant UUID' })
  @ApiResponse({ status: 200, description: 'Detailed vesting schedule' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  async getVestingSchedule(
    @Param('companyId') companyId: string,
    @Param('grantId') grantId: string,
  ) {
    return this.optionPlanService.getGrantVestingSchedule(companyId, grantId);
  }

  @Post('option-grants/:grantId/cancel')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Cancel/terminate an option grant' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'grantId', description: 'Option grant UUID' })
  @ApiResponse({ status: 200, description: 'Grant cancelled' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  @ApiResponse({ status: 422, description: 'Grant already cancelled or exercised' })
  async cancelGrant(
    @Param('companyId') companyId: string,
    @Param('grantId') grantId: string,
  ) {
    return this.optionPlanService.cancelGrant(companyId, grantId);
  }

  // ========================
  // Option Exercise Endpoints
  // ========================

  @Post('option-grants/:grantId/exercise')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'EMPLOYEE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Create an exercise request for a grant' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'grantId', description: 'Option grant UUID' })
  @ApiResponse({ status: 201, description: 'Exercise request created' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  @ApiResponse({ status: 422, description: 'Insufficient vested options or pending request' })
  async createExercise(
    @Param('companyId') companyId: string,
    @Param('grantId') grantId: string,
    @Body() dto: CreateExerciseRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.optionPlanService.createExerciseRequest(companyId, grantId, dto, user.id);
  }

  @Get('option-exercises')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List all exercise requests for the company' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of exercise requests' })
  async listExercises(
    @Param('companyId') companyId: string,
    @Query() query: ListExerciseRequestsQueryDto,
  ) {
    const { items, total } = await this.optionPlanService.findAllExercises(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Get('option-exercises/:exerciseId')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get exercise request detail' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'exerciseId', description: 'Exercise request UUID' })
  @ApiResponse({ status: 200, description: 'Exercise request detail' })
  @ApiResponse({ status: 404, description: 'Exercise request not found' })
  async getExercise(
    @Param('companyId') companyId: string,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.optionPlanService.findExerciseById(companyId, exerciseId);
  }

  @Post('option-exercises/:exerciseId/confirm')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Confirm payment and issue shares for exercise' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'exerciseId', description: 'Exercise request UUID' })
  @ApiResponse({ status: 200, description: 'Payment confirmed, shares issued' })
  @ApiResponse({ status: 404, description: 'Exercise request not found' })
  @ApiResponse({ status: 422, description: 'Already confirmed or not pending' })
  async confirmExercise(
    @Param('companyId') companyId: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: ConfirmExercisePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.optionPlanService.confirmExercisePayment(companyId, exerciseId, dto, user.id);
  }

  @Post('option-exercises/:exerciseId/cancel')
  @Roles('ADMIN', 'EMPLOYEE')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Cancel a pending exercise request' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'exerciseId', description: 'Exercise request UUID' })
  @ApiResponse({ status: 200, description: 'Exercise request cancelled' })
  @ApiResponse({ status: 404, description: 'Exercise request not found' })
  @ApiResponse({ status: 422, description: 'Already cancelled or not pending' })
  async cancelExercise(
    @Param('companyId') companyId: string,
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.optionPlanService.cancelExercise(companyId, exerciseId, user.id);
  }
}
