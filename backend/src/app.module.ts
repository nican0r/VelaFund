import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { MemberModule } from './member/member.module';
import { ShareClassModule } from './share-class/share-class.module';
import { ShareholderModule } from './shareholder/shareholder.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'read', ttl: 60000, limit: 100 },
      { name: 'write', ttl: 60000, limit: 30 },
      { name: 'upload', ttl: 60000, limit: 10 },
      { name: 'blockchain', ttl: 60000, limit: 10 },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompanyModule,
    MemberModule,
    ShareClassModule,
    ShareholderModule,
  ],
  providers: [
    // BUG-3 fix: Register ThrottlerGuard globally — rate limits apply to all endpoints.
    // Use @Throttle() to override per-endpoint, @SkipThrottle() to opt out.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
