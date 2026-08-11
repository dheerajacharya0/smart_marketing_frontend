/**
 * Error-reporting seam (Phase 0 #2).
 *
 * A single choke point every boundary / global handler calls to report an error.
 * Today it reads `NEXT_PUBLIC_SENTRY_DSN`; when that is unset (current state) it
 * only logs to the console, so nothing breaks and no network calls are made.
 *
 * To go live with Sentry later: `yarn add @sentry/nextjs`, init it once with the
 * DSN, and replace the body of `reportError` with `Sentry.captureException`.
 * Every call site already funnels through here, so that is a one-function change.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

/** True once a real error sink (Sentry) is configured via env. */
export const errorReportingEnabled = Boolean(SENTRY_DSN)

export interface ErrorContext {
  /** Where the error came from, e.g. "app/error.tsx", "unhandledrejection". */
  source?: string
  /** Next.js error digest, when available. */
  digest?: string
  /** Any extra structured detail worth attaching to the report. */
  [key: string]: unknown
}

/**
 * Report an error. No-ops to console until a DSN is configured; safe to call
 * from client or server, in any environment.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  if (errorReportingEnabled) {
    // TODO(Phase 0 #2): forward to Sentry once @sentry/nextjs is wired.
    // Sentry.captureException(error, { extra: context })
  }
  // Until then, keep it visible in logs. console.error is intentional.
  // eslint-disable-next-line no-console
  console.error("[reportError]", context.source ?? "unknown", error, context)
}

/**
 * Attach a global handler for otherwise-unhandled promise rejections so silent
 * async failures still reach the reporter. Idempotent. Client-only.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return
  const w = window as Window & { __obsHandlersInstalled?: boolean }
  if (w.__obsHandlersInstalled) return
  w.__obsHandlersInstalled = true

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" })
  })
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { source: "window.onerror" })
  })
}
