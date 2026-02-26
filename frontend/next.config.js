const createNextIntlPlugin = require('next-intl/plugin');
const { withSentryConfig } = require('@sentry/nextjs');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  // Suppress Sentry CLI source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: true,

  // Do not widen the Next.js tracing — use only the Sentry SDK tracing
  widenClientFileUpload: false,

  // Disable automatic instrumentation of API routes (backend handles its own Sentry)
  autoInstrumentServerFunctions: false,

  // Disable telemetry
  telemetry: false,
});
