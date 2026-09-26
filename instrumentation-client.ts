import * as Sentry from "@sentry/nextjs"
import { sentryOptions } from "@/lib/sentry"

// Browser-side Sentry. Its global handlers take over window.onerror and
// unhandledrejection, which is why installGlobalErrorHandlers() stands down
// when a DSN is set (lib/observability.ts).
Sentry.init(sentryOptions)

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
