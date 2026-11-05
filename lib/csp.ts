/**
 * Nonce-based Content-Security-Policy, built per request by `middleware.ts`.
 *
 * Replaces `script-src 'unsafe-inline' 'unsafe-eval'` (security audit
 * 2026-11-05, finding #1): only scripts carrying this request's nonce run, and
 * `'strict-dynamic'` extends that trust to scripts *they* load — Next's chunks,
 * the Facebook SDK (lib/facebook-sdk.ts), Razorpay Checkout (lib/razorpay.ts),
 * Vercel Analytics. An injected inline <script> has no nonce and is blocked.
 *
 * Next reads the nonce back out of the request's CSP header and stamps it on
 * its own scripts; our inline scripts get it from `getNonce()` (lib/nonce.ts).
 *
 * Rollout: shipped as Report-Only first, alongside the existing enforced policy
 * in next.config.mjs. Once production shows no violations, middleware switches
 * to the enforcing header and the static one in next.config.mjs is deleted.
 */

export const NONCE_HEADER = "x-nonce"

/** 128 bits of randomness, base64 — what CSP nonces are expected to look like. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Plaintext origins the browser must be allowed to reach, which `https:` and
 * `wss:` in connect-src don't cover: an http:// API is the local shape (see
 * .env.example), where REST and the realtime socket are two ports on one
 * machine. Empty for a TLS deploy, so production allows no plaintext at all.
 * Mirrors the derivation in config/api-config.ts and next.config.mjs.
 *
 * Takes the values as arguments (not process.env) so it is testable; NEXT_PUBLIC
 * vars must be read by literal name at the call site for Next to inline them.
 */
export function plaintextConnectOrigins(
  apiBaseUrl: string | undefined,
  wsPort: string | undefined,
  wsUrl: string | undefined
): string[] {
  const origins: string[] = []
  try {
    const api = new URL(apiBaseUrl || "http://localhost:3000")
    if (api.protocol === "http:") {
      origins.push(api.origin)
      origins.push(`ws://${api.hostname}:${wsPort || "3002"}`)
    }
  } catch {
    // lib/env.ts rejects a malformed URL at load; nothing to allow here.
  }
  const wsOverride = wsUrl?.trim()
  if (wsOverride) {
    try {
      const ws = new URL(wsOverride.replace(/^http(s?):\/\//, "ws$1://"))
      if (ws.protocol === "ws:") origins.push(ws.origin)
    } catch {
      // Same: validated elsewhere.
    }
  }
  return origins
}

export interface CspOptions {
  nonce: string
  /** Dev only: React's dev build and Fast Refresh use eval. Never in production. */
  isDev: boolean
  plaintextOrigins: string[]
}

export function buildCsp({ nonce, isDev, plaintextOrigins }: CspOptions): string {
  return [
    "default-src 'self'",
    // The host list is ignored by browsers that support 'strict-dynamic' and is
    // only a fallback for those that don't (where the nonce still applies).
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://checkout.razorpay.com",
      "https://connect.facebook.net",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ].join(" "),
    // Inline styles stay allowed: React `style={}` props, next/font and the
    // chart <style> all need it, and style injection is far lower risk.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Inbox <video>/<audio>: blob: from lib/whatsapp-media-cache.ts or https links.
    "media-src 'self' blob: https:",
    ["connect-src 'self' https: wss:", ...plaintextOrigins].join(" "),
    // Razorpay Checkout iframe; Facebook SDK arbiter + signup dialog iframes.
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.facebook.com https://staticxx.facebook.com",
    "frame-ancestors 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")
}
