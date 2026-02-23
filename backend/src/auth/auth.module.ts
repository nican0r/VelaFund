import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    // Register AuthGuard globally — all routes require auth by default.
    // Use @Public() to opt out for specific routes.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // BUG-2 fix: Register RolesGuard globally — enforces @Roles() on company-scoped endpoints.
    // Runs after AuthGuard (user must be authenticated first).
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
