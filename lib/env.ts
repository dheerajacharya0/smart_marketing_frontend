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
  /**
   * Realtime chat WebSocket port. Optional; defaults to 3002.
   *
   * Only consulted when NEXT_PUBLIC_CHAT_WS_URL is unset. It assumes the
   * realtime server is reachable on its own port at the API's hostname — true
   * when the backend runs directly, false behind any proxy publishing one port.
   */
  NEXT_PUBLIC_CHAT_WS_PORT: z.string().default("3002"),
  /**
   * Full origin of the realtime WebSocket server, e.g. `wss://api.example.com`.
   * Optional; when set it overrides NEXT_PUBLIC_CHAT_WS_PORT.
   *
   * The backend listens on two ports that are not interchangeable: the REST API
   * on 3000 and a separate uWebSockets server on 3002. Deployed, those usually
   * arrive on ONE public origin with the realtime half routed by path (`/ws`),
   * because most hosting routes a single port per service. Deriving
   * `hostname + ":3002"` from the API URL cannot express that, and the failure
   * is silent — REST keeps working and the inbox just stops updating.
   *
   * Leave unset for local development, where the two ports really are separate.
   */
  NEXT_PUBLIC_CHAT_WS_URL: z.string().url().optional().or(z.literal("")),
  /** Sentry DSN. Optional — error reporting no-ops when unset. */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  /** Sentry environment tag, e.g. "production" on Railway. Defaults to NODE_ENV. */
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional().or(z.literal("")),
  /** Meta App ID for the Facebook JS SDK (Embedded Signup). */
  NEXT_PUBLIC_FACEBOOK_APP_ID: z.string().optional().or(z.literal("")),
  /** Embedded Signup config_id from the Meta App Dashboard. */
  NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID: z.string().optional().or(z.literal("")),
  /** Graph API version for FB.init, e.g. "v21.0". */
  NEXT_PUBLIC_FACEBOOK_GRAPH_VERSION: z.string().default("v21.0"),
  /**
   * Where support requests go. Optional — when unset, the support page says so
   * plainly rather than offering a contact route that reaches nobody.
   */
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional().or(z.literal("")),
  /**
   * Mirrors the backend's `PHONE_VALIDATION_DISABLED`. Set both together.
   *
   * That flag exists for one situation: a carrier opens a new number range,
   * the bundled `libphonenumber-js` metadata predates it, and a customer with
   * a genuinely real number cannot send at all until a dependency bump ships.
   * Turning it off server-side while this form still refuses the number leaves
   * that customer exactly as stuck — the escape hatch has to open on both
   * sides or it isn't one. Off, the form falls back to the E.164 shape check
   * and lets Meta decide, which is what shipped before the plan check.
   */
  NEXT_PUBLIC_PHONE_VALIDATION_DISABLED: z.string().optional().or(z.literal("")),
})

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_CHAT_WS_PORT: process.env.NEXT_PUBLIC_CHAT_WS_PORT,
  NEXT_PUBLIC_CHAT_WS_URL: process.env.NEXT_PUBLIC_CHAT_WS_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_FACEBOOK_APP_ID: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
  NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID: process.env.NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID,
  NEXT_PUBLIC_FACEBOOK_GRAPH_VERSION: process.env.NEXT_PUBLIC_FACEBOOK_GRAPH_VERSION,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_PHONE_VALIDATION_DISABLED: process.env.NEXT_PUBLIC_PHONE_VALIDATION_DISABLED,
})

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n")
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
