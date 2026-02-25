import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
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

@Controller('api/v1/users/me/reports')
export class PortfolioController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/users/me/reports/portfolio
   * Returns the authenticated investor's portfolio across all companies.
   */
  @Get('portfolio')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getPortfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getPortfolio(user.id);
  }
}
