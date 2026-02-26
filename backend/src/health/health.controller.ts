import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { S3Service } from '../aws/s3.service';

@ApiTags('Health')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const [dbHealthy, redisHealthy] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const allHealthy = dbHealthy && redisHealthy;

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        redis: this.redis ? (redisHealthy ? 'up' : 'down') : 'unconfigured',
        s3: this.s3Service.isAvailable() ? 'configured' : 'unconfigured',
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
