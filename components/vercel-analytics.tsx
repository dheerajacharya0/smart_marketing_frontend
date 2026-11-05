"use client"

import { Analytics } from "@vercel/analytics/next"
import { scrubUrl } from "@/lib/url-secrets"

/**
 * Vercel Analytics with secret query params (reset/verify tokens, invite and
 * OAuth codes) redacted from every page view. A client component because
 * `beforeSend` is a function, which a server component can't pass down.
 */
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: scrubUrl(event.url) })} />
}
