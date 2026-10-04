/**
 * Pre-launch password gate.
 *
 * While `SITE_ACCESS_PASSWORD` is set, everything except the public landing
 * page needs the `cz_access` cookie (see middleware.ts). Unset it on launch day
 * and the gate disappears — no code change.
 *
 * The cookie holds a SHA-256 of the password, not the password, so it can be
 * checked at the edge with Web Crypto and rotating the password logs everyone
 * out. This is a curtain over an unlaunched product, not authentication: the
 * backend JWT is still the real gate behind it.
 */

export const GATE_COOKIE = "cz_access"
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Paths reachable without the gate cookie. */
const PUBLIC_PATHS = new Set(["/", "/privacy", "/early-access", "/api/waitlist", "/api/early-access"])

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname)
}

/** Server-only; never NEXT_PUBLIC, the value must not reach the bundle. */
export function gatePassword(): string | undefined {
  return process.env.SITE_ACCESS_PASSWORD || undefined
}

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`converszio-gate:v1:${password}`)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Constant-time string compare, so a wrong guess doesn't leak how close it was. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Where to send someone after they unlock. Only same-site paths: a `next` of
 * `//evil.com` or `https://…` would make this an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = "/login"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  if (next === "/early-access" || next.startsWith("/early-access?")) return fallback
  return next
}
