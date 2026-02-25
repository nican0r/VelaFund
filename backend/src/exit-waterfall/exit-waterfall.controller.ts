import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExitWaterfallService } from './exit-waterfall.service';
import { RunWaterfallDto } from './dto/run-waterfall.dto';
import { SaveScenarioDto } from './dto/save-scenario.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/helpers/paginate';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

@Controller('api/v1/companies/:companyId/reports/waterfall')
export class ExitWaterfallController {
  constructor(private readonly waterfallService: ExitWaterfallService) {}

  /**
   * Run an exit waterfall scenario.
   * POST because it triggers a complex calculation with a request body.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  async runWaterfall(
    @Param('companyId') companyId: string,
    @Body() dto: RunWaterfallDto,
  ) {
    return this.waterfallService.runWaterfall(companyId, dto);
  }

  /**
   * Save a waterfall scenario for later comparison.
   */
  @Post('scenarios')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  async saveScenario(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveScenarioDto,
  ) {
    return this.waterfallService.saveScenario(companyId, user.id, dto);
  }

  /**
   * List saved waterfall scenarios (lightweight — no resultData).
   */
  @Get('scenarios')
  @Roles('ADMIN')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async listScenarios(
    @Param('companyId') companyId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { items, total } = await this.waterfallService.listScenarios(
      companyId,
      pagination.page,
      pagination.limit,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  /**
   * Get a saved scenario with full result data.
   */
  @Get('scenarios/:scenarioId')
  @Roles('ADMIN')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getScenario(
    @Param('companyId') companyId: string,
    @Param('scenarioId') scenarioId: string,
  ) {
    return this.waterfallService.getScenario(companyId, scenarioId);
  }

  /**
   * Delete a saved scenario.
   */
  @Delete('scenarios/:scenarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  async deleteScenario(
    @Param('companyId') companyId: string,
    @Param('scenarioId') scenarioId: string,
  ): Promise<void> {
    await this.waterfallService.deleteScenario(companyId, scenarioId);
  }
}
