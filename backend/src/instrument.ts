/**
 * Sentry Instrumentation for NestJS Backend
 *
 * MUST be imported before any other module in main.ts.
 * Initializes Sentry with:
 *   - PII redaction via beforeSend hook (LGPD compliance)
 *   - Environment-based configuration
 *   - Graceful degradation when SENTRY_DSN is not set
 *
 * Per error-handling.md:
 *   - 5xx → captured at 'error' level with errorCode tag
 *   - Unhandled → captured at 'fatal' level
 *   - 4xx → breadcrumb only (not reported as errors)
 *   - PII is always redacted via beforeSend
 */
import * as Sentry from '@sentry/nestjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!SENTRY_DSN,

  // Sample 100% of errors, 10% of performance transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // PII redaction hook — runs before any event is sent to Sentry
  beforeSend(event) {
    // Redact sensitive headers from request data
    if (event.request?.headers) {
      const headers = event.request.headers;
      if (headers['authorization']) {
        headers['authorization'] = '[REDACTED]';
      }
      if (headers['cookie']) {
        headers['cookie'] = '[REDACTED]';
      }
      if (headers['x-csrf-token']) {
        headers['x-csrf-token'] = '[REDACTED]';
      }
    }

    // Redact request body data (may contain PII like CPF, email)
    if (event.request?.data && typeof event.request.data === 'string') {
      try {
        const parsed = JSON.parse(event.request.data);
        event.request.data = JSON.stringify(redactPiiFields(parsed));
      } catch {
        // Not JSON, leave as-is
      }
    }

    // Redact PII from extra context
    if (event.extra) {
      event.extra = redactPiiFields(event.extra as Record<string, unknown>);
    }

    // Redact user PII — keep ID for correlation, mask email/ip
    if (event.user) {
      if (event.user.email) {
        const [first, ...rest] = event.user.email.split('@');
        event.user.email =
          first && rest.length
            ? `${first[0]}***@${rest.join('@')}`
            : '[REDACTED]';
      }
      if (event.user.ip_address) {
        event.user.ip_address = maskIpAddress(event.user.ip_address);
      }
      // Remove username if it contains PII
      if (event.user.username) {
        delete event.user.username;
      }
    }

    return event;
  },

  // Scrub sensitive fields from breadcrumb data
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) {
      breadcrumb.data = redactPiiFields(
        breadcrumb.data as Record<string, unknown>,
      );
    }
    return breadcrumb;
  },
});

/**
 * PII-sensitive field names to redact.
 * Matches the field detection logic in common/utils/redact-pii.ts
 */
const SENSITIVE_PATTERNS =
  /^(cpf|cpfNumber|cpfEncrypted|cnpj|cnpjNumber|password|token|secret|apiKey|apiToken|authorization|cookie|sessionId|privyToken|blindIndexKey|bankAccount|bankAccountNumber|bankRoutingNumber|accountNumber|routingNumber|accessToken|refreshToken|appSecret)$/i;

const EMAIL_PATTERN =
  /^(email|userEmail|targetEmail|inviteeEmail)$/i;

const IP_PATTERN = /^(ip|ipAddress|remoteAddress|clientIp)$/i;

const WALLET_PATTERN = /^(walletAddress|wallet|fromWallet|toWallet)$/i;

/**
 * Recursively redact PII fields from an object.
 * Lightweight version for Sentry beforeSend (avoids importing full redactPii
 * which would create a circular dependency with instrument.ts loading first).
 */
function redactPiiFields(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5 || !obj || typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_PATTERNS.test(key)) {
      result[key] = '[REDACTED]';
    } else if (EMAIL_PATTERN.test(key) && typeof value === 'string') {
      const [first, ...rest] = value.split('@');
      result[key] =
        first && rest.length
          ? `${first[0]}***@${rest.join('@')}`
          : '[REDACTED]';
    } else if (IP_PATTERN.test(key) && typeof value === 'string') {
      result[key] = maskIpAddress(value);
    } else if (WALLET_PATTERN.test(key) && typeof value === 'string') {
      result[key] =
        value.length > 10
          ? `${value.slice(0, 6)}...${value.slice(-4)}`
          : '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactPiiFields(
        value as Record<string, unknown>,
        depth + 1,
      );
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object'
          ? redactPiiFields(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Mask IP address to /24 subnet (per security.md).
 */
function maskIpAddress(ip: string): string {
  if (!ip) return 'unknown';
  const clean = ip.replace('::ffff:', '');
  const parts = clean.split('.');
  if (parts.length === 4) {
    parts[3] = '0/24';
    return parts.join('.');
  }
  return ip; // IPv6 or unknown format — leave as-is for Sentry
}
