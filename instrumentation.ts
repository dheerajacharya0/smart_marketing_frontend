import * as Sentry from "@sentry/nextjs"
import { sentryOptions } from "@/lib/sentry"

// Server and edge Sentry. `@sentry/nextjs` resolves to the right build per
// runtime, so one init with the shared options covers both.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions)
  }
}

// Errors thrown while rendering a server component, a route handler or
// middleware — the ones app/error.tsx only ever sees as a digest.
export const onRequestError = Sentry.captureRequestError
