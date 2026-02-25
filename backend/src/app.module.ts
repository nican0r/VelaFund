import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { MemberModule } from './member/member.module';
import { ShareClassModule } from './share-class/share-class.module';
import { ShareholderModule } from './shareholder/shareholder.module';
import { CapTableModule } from './cap-table/cap-table.module';
import { TransactionModule } from './transaction/transaction.module';
import { FundingRoundModule } from './funding-round/funding-round.module';
import { OptionPlanModule } from './option-plan/option-plan.module';
import { ConvertibleModule } from './convertible/convertible.module';
import { AwsModule } from './aws/aws.module';

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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        ),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
    }),
    RedisModule,
    AwsModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CompanyModule,
    MemberModule,
    ShareClassModule,
    ShareholderModule,
    CapTableModule,
    TransactionModule,
    FundingRoundModule,
    OptionPlanModule,
    ConvertibleModule,
  ],
  providers: [
    // Register ThrottlerGuard globally — rate limits apply to all endpoints.
    // Use @Throttle() to override per-endpoint, @SkipThrottle() to opt out.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
