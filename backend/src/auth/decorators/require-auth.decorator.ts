import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as requiring authentication.
 *
 * Since AuthGuard is registered as a global APP_GUARD, all routes require
 * authentication by default (except those marked with @Public()). This
 * decorator is purely for documentation/readability — it signals intent
 * without adding a second guard execution.
 *
 * Previously this used UseGuards(AuthGuard) which caused double guard
 * execution (2x Privy API calls per request). Fixed in BUG-9.
 */
export const REQUIRE_AUTH_KEY = 'requireAuth';
export const RequireAuth = () => SetMetadata(REQUIRE_AUTH_KEY, true);
