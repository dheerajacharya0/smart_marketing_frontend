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
  console.error("[reportError]", context.source ?? "unknown", error, context)
}

/**
 * Report a failure that the UI deliberately absorbs (Phase E #5).
 *
 * Dozens of secondary fetches are non-blocking on purpose — a tag list that
 * doesn't load costs a suggestion dropdown, not the page, and turning that into
 * a toast would train people to dismiss toasts. But an empty catch handler also
 * means nobody ever learns the tag endpoint has been failing for a week.
 *
 * This is the middle position: still silent to the user, no longer silent to
 * us. It stays quieter than `reportError` — these are expected-ish, and a
 * console full of red for a degraded dropdown is its own kind of noise.
 */
export function reportSilent(error: unknown, context: ErrorContext = {}): void {
  if (errorReportingEnabled) {
    // TODO(Phase 0 #2): send as a Sentry breadcrumb rather than an exception —
    // these are context for a later failure, not failures themselves.
    // Sentry.addBreadcrumb({ level: "warning", data: { ...context } })
    return
  }
  // Without a sink, dev is the only place this can be seen, and production has
  // nowhere to put it. console.debug is hidden by default in most consoles,
  // which is the right volume for something the user was never told about.
  if (process.env.NODE_ENV !== "production") {
    console.debug("[silent]", context.source ?? "unknown", error, context)
  }
}

/**
 * A `.catch()` handler that absorbs the failure and breadcrumbs it.
 *
 * `listContactTags(id).catch(swallow("app/dashboard/contacts/page.tsx"))`
 *
 * The source is the file, not a description of the call: the error itself
 * carries the URL and status, so the pair locates the call site without every
 * site having to invent a label that drifts from what it does.
 */
export function swallow(source: string, context: ErrorContext = {}) {
  return (error: unknown): void => {
    reportSilent(error, { source, ...context })
  }
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
