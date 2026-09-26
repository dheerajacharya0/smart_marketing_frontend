/**
 * Error-reporting seam (Phase 0 #2).
 *
 * A single choke point every boundary / global handler calls to report an error.
 * With `NEXT_PUBLIC_SENTRY_DSN` set it forwards to Sentry (initialised in
 * `instrumentation-client.ts` / `instrumentation.ts`, options in
 * `lib/sentry.ts`); unset, it only logs to the console and makes no network
 * calls.
 */
import * as Sentry from "@sentry/nextjs"

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
    // `source` as a tag so the Sentry issue list can be filtered by it.
    Sentry.captureException(error, {
      tags: { source: context.source ?? "unknown" },
      extra: context,
    })
  }
  // Still visible in the console either way. console.error is intentional.
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
    // A breadcrumb, not an event: these are context for a later failure, not
    // failures themselves, and as events they would spend the quota.
    Sentry.addBreadcrumb({
      category: "silent",
      level: "warning",
      message: `${context.source ?? "unknown"}: ${error instanceof Error ? error.message : String(error)}`,
      data: context,
    })
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
 * Record a Core Web Vitals measurement (components/web-vitals.tsx).
 *
 * A breadcrumb, never an event: five metrics a page load would burn the free
 * tier's error quota in hours, and a metric isn't an error. Attached to the
 * next real error, a poor LCP or INP is useful context for it.
 */
export function reportMetric(metric: {
  name: string
  value: number
  rating: string
  id: string
}): void {
  if (!errorReportingEnabled) return
  Sentry.addBreadcrumb({
    category: "web-vital",
    level: metric.rating === "poor" ? "warning" : "info",
    message: `${metric.name} ${Math.round(metric.value)} (${metric.rating})`,
    data: metric,
  })
}

/**
 * Attach a global handler for otherwise-unhandled promise rejections so silent
 * async failures still reach the reporter. Idempotent. Client-only.
 *
 * Only without Sentry: its own global handlers already capture both events, and
 * ours on top would report every uncaught error twice.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return
  if (errorReportingEnabled) return
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
