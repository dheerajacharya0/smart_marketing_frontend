/**
 * Environment validation (Phase A #3).
 *
 * Validates the public runtime config once, at module load. A missing required
 * var fails the **build** in production instead of silently falling back to
 * localhost in a deployed app. In development the fallbacks are allowed so a
 * fresh clone runs with zero setup.
 *
 * NEXT_PUBLIC_* vars must be referenced by their literal name (below) so Next
 * inlines them at build time — do not read them through a computed key.
 */
import { z } from "zod"

const isProd = process.env.NODE_ENV === "production"

const schema = z.object({
  /** Backend REST base URL. Required in production; defaults to localhost in dev. */
  NEXT_PUBLIC_API_BASE_URL: isProd
    ? z.string().url("NEXT_PUBLIC_API_BASE_URL must be a valid URL in production")
    : z.string().url().default("http://localhost:3000"),
  /** Realtime chat WebSocket port. Optional; defaults to 3002. */
  NEXT_PUBLIC_CHAT_WS_PORT: z.string().default("3002"),
  /** Sentry DSN. Optional — error reporting no-ops when unset. */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
})

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_CHAT_WS_PORT: process.env.NEXT_PUBLIC_CHAT_WS_PORT,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
})

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n")
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
