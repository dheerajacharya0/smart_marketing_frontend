/**
 * Sentry options shared by the browser, Node and edge inits
 * (`instrumentation-client.ts`, `instrumentation.ts`), so the three runtimes
 * can't drift on what they send.
 *
 * Errors only, on purpose. We're on the free tier, whose quota a single busy
 * page can exhaust: no performance tracing (`tracesSampleRate` left unset, which
 * keeps tracing off rather than sampling zero) and no session replay — replay
 * would also record customers' WhatsApp conversations off the inbox screen.
 */
import type { BrowserOptions } from "@sentry/nextjs"

// Literal name so Next inlines it into the client bundle (see CLAUDE.md).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined

export const sentryOptions: BrowserOptions = {
  dsn,
  // No DSN, no SDK: nothing is sent and no network calls are made.
  enabled: Boolean(dsn),
  // Distinguishes Railway from a local `yarn build && yarn start`, which are
  // both NODE_ENV=production.
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  // v11 collects cookies, headers, request/response bodies and stack-frame
  // locals by default. Here those carry the session cookie, customers' phone
  // numbers and message text — none of it belongs in a third-party error
  // tracker. The stack trace and our own `extra` context are enough.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    stackFrameVariables: false,
  },
  // Errors thrown by browser extensions land in window.onerror too, and are
  // nothing we can fix — they'd only spend quota.
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
  ignoreErrors: [
    // Benign: the browser skipped a resize notification in one frame.
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],
}
