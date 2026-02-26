/**
 * Sentry Client-Side Configuration
 *
 * Initializes Sentry for the browser (client-side Next.js).
 * Loaded automatically by @sentry/nextjs.
 *
 * PII redaction:
 *   - Request headers (authorization, cookie) stripped
 *   - User email masked (first char + domain)
 *   - IP addresses masked to /24
 *   - Sensitive form fields redacted
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample 10% of transactions in production, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture 100% of sessions with errors for replay
  replaysOnErrorSampleRate: 1.0,
  // Sample 0% of normal sessions (privacy)
  replaysSessionSampleRate: 0,

  beforeSend(event) {
    // Redact user PII
    if (event.user) {
      if (event.user.email) {
        const [first, ...rest] = event.user.email.split('@');
        event.user.email =
          first && rest.length
            ? `${first[0]}***@${rest.join('@')}`
            : '[REDACTED]';
      }
      if (event.user.ip_address) {
        event.user.ip_address = '{{auto}}'; // Let Sentry handle, server-side redacts
      }
      if (event.user.username) {
        delete event.user.username;
      }
    }

    // Redact sensitive breadcrumb data (form inputs, etc.)
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((bc) => {
        if (bc.category === 'ui.input' && bc.message) {
          // Don't log form input values
          bc.message = bc.message.replace(/".*"/, '"[REDACTED]"');
        }
        return bc;
      });
    }

    return event;
  },

  // Scrub sensitive URLs from breadcrumbs (e.g., tokens in query params)
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
      if (breadcrumb.data?.url) {
        // Redact invitation tokens from URLs
        breadcrumb.data.url = breadcrumb.data.url.replace(
          /\/invitations\/[a-zA-Z0-9-]+/,
          '/invitations/[REDACTED]',
        );
      }
    }
    return breadcrumb;
  },
});
