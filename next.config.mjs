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
    // Phase S #2 — security headers. CSP ships in **report-only** first so it
    // cannot break the app; watch violation reports, tighten, then switch the
    // header name to `Content-Security-Policy` to enforce. The rest are safe to
    // enforce immediately.
    const csp = [
      "default-src 'self'",
      // Next.js injects inline/eval'd scripts in dev and inline runtime chunks.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // REST + WebSocket to any origin/port until the CSP is tightened per-env.
      "connect-src 'self' https: wss: ws:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ]
  },
}

export default nextConfig
