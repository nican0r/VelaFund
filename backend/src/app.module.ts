import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

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
  ],
})
export class AppModule {}
