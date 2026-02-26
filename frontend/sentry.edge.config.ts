/**
 * Sentry Edge Runtime Configuration
 *
 * Initializes Sentry for Next.js edge runtime (middleware, edge API routes).
 * Loaded via instrumentation.ts when NEXT_RUNTIME === 'edge'.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
