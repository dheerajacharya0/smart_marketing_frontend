// The config entry point, not the package root: the root is CommonJS, which
// Node's ESM loader can't give named exports for.
import { withSentryConfig } from "@sentry/nextjs/config"

/**
 * Plaintext origins the browser must be allowed to reach, which `https:` and
 * `wss:` in connect-src don't cover: an http:// API is the local shape (see
 * .env.example), where REST and the realtime socket are two ports on one
 * machine. Empty for a TLS deploy, so production allows no plaintext at all.
 * Mirrors the derivation in config/api-config.ts, which this file can't import.
 */
function plaintextConnectOrigins() {
  const origins = []
  try {
    const api = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000")
    if (api.protocol === "http:") {
      origins.push(api.origin)
      origins.push(`ws://${api.hostname}:${process.env.NEXT_PUBLIC_CHAT_WS_PORT || "3002"}`)
    }
  } catch {
    // lib/env.ts rejects a malformed URL at load; nothing to allow here.
  }
  const wsOverride = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim()
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Phase 2 — lint gate flipped ON. `next lint` is error-clean; a lint error
    // now fails the build. Revert to true only as a temporary escape hatch.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Phase 2 — type gate flipped ON. tsc --noEmit is clean; a type error now
    // fails the build. Revert to true only as a temporary escape hatch.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    // Phase S #2 — security headers. CSP is **enforced**: anything a directive
    // below doesn't allow is blocked, not just reported. A new third-party
    // script, iframe, media host or API origin needs a line here first.
    const csp = [
      "default-src 'self'",
      // Next.js injects inline/eval'd scripts in dev and inline runtime chunks.
      // checkout.razorpay.com serves the top-up Checkout widget (lib/razorpay.ts).
      // connect.facebook.net serves the Facebook JS SDK that Embedded Signup
      // needs (lib/facebook-sdk.ts appends it as a <script>).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // <video>/<audio> in the inbox (components/chat/media-bubble.tsx) play
      // either a blob: URL from lib/whatsapp-media-cache.ts or a sender's https
      // link. Without this, media-src falls back to default-src 'self' and
      // every voice note and video goes silent.
      "media-src 'self' blob: https:",
      // REST + WebSocket over TLS to any origin, plus the plaintext local API
      // and socket when NEXT_PUBLIC_API_BASE_URL is http://.
      ["connect-src 'self' https: wss:", ...plaintextConnectOrigins()].join(" "),
      // Razorpay Checkout renders in an iframe it injects; without this it dies
      // the moment the CSP stops being report-only. The Facebook SDK does the
      // same: a hidden cross-domain-arbiter iframe on staticxx.facebook.com, and
      // www.facebook.com for the signup dialog. (The Embedded Signup window
      // itself is a popup, which CSP does not govern.)
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.facebook.com https://staticxx.facebook.com",
      "frame-ancestors 'none'",
      // public/sw.js (Web Push) and app/manifest.ts. Without worker-src the
      // fallback is script-src, which works today but is the wrong thing to
      // lean on once this is enforced.
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // A cached service worker keeps running old code until the cache
        // expires; browsers cap it at 24h, but a fix to push handling should
        // reach phones on their next visit, not tomorrow.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Build-time only, never NEXT_PUBLIC: they upload source maps so Sentry shows
  // readable stack traces. Set them on Railway; a build without them (local, CI)
  // still works, it just skips the upload.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    // With no token there is nowhere to upload to, and generated-but-kept
    // source maps would be served publicly beside the bundles. Don't make them.
    disable: !process.env.SENTRY_AUTH_TOKEN,
    // After upload they're only needed by Sentry; don't ship them.
    deleteSourcemapsAfterUpload: true,
  },
  // Events go to our own origin and are forwarded from the server, so ad
  // blockers (which block *.sentry.io) don't hide errors, and connect-src stays
  // 'self' for them. A fixed path, not `true`, so it can never collide with the
  // /dashboard matcher in middleware.ts.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  telemetry: false,
})
