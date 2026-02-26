/**
 * Next.js Instrumentation Hook
 *
 * Initializes Sentry for server-side and edge runtimes.
 * The client-side config (sentry.client.config.ts) is loaded automatically
 * by @sentry/nextjs.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
