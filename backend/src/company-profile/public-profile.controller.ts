import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CompanyProfileService } from './company-profile.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/v1/profiles')
export class PublicProfileController {
  constructor(private readonly profileService: CompanyProfileService) {}

  // ─── 11. GET PUBLIC PROFILE ─────────────────────────────────────────

  @Get(':slug')
  @Public()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async getPublicProfile(
    @Param('slug') slug: string,
    @Query('password') password?: string,
    @Query('email') email?: string,
    @Req() req?: Request,
  ) {
    const ip = req?.ip;
    const userAgent = req?.headers['user-agent'];
    const referrer = req?.headers['referer'] || req?.headers['referrer'];

    return this.profileService.getPublicProfile(
      slug,
      password,
      email,
      ip,
      userAgent,
      referrer as string | undefined,
    );
  }
}
