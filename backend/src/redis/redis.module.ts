import {
  Global,
  Module,
  Logger,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          logger.warn(
            'REDIS_URL not configured. Redis-dependent features (queues, sessions) will be unavailable.',
          );
          return null;
        }

        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 10) return null; // Stop retrying after 10 attempts
            return Math.min(times * 200, 3000);
          },
        });

        client.on('error', (err) => {
          logger.error(`Redis connection error: ${err.message}`);
        });

        client.on('connect', () => {
          logger.log('Redis connected successfully');
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger('RedisModule');

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
        this.logger.log('Redis connection closed');
      } catch (err) {
        this.logger.error(`Error closing Redis connection: ${(err as Error).message}`);
      }
    }
  }
}
