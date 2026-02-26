/**
 * Sentry Server-Side Configuration
 *
 * Initializes Sentry for Next.js server-side rendering (Node.js runtime).
 * Loaded via instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  beforeSend(event) {
    // Redact user PII on server side
    if (event.user) {
      if (event.user.email) {
        const [first, ...rest] = event.user.email.split('@');
        event.user.email =
          first && rest.length
            ? `${first[0]}***@${rest.join('@')}`
            : '[REDACTED]';
      }
      if (event.user.ip_address) {
        const parts = event.user.ip_address.replace('::ffff:', '').split('.');
        if (parts.length === 4) {
          parts[3] = '0/24';
          event.user.ip_address = parts.join('.');
        }
      }
      if (event.user.username) {
        delete event.user.username;
      }
    }

    return event;
  },
});
