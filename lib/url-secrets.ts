/**
 * Query params that carry a secret: password-reset and email-verify `token`,
 * team-invite and OAuth `code`, OAuth `state`. Whoever holds one can act as
 * the person it was sent to until it expires, so it must not end up in
 * Vercel Analytics page views or Sentry breadcrumbs/events.
 */
const SECRET_PARAM = /([?&](?:token|code|state)=)[^&#]*/gi

/** Replace secret query-param values with `[redacted]`; everything else is untouched. */
export function scrubUrl(url: string): string {
  return url.replace(SECRET_PARAM, "$1[redacted]")
}

/**
 * Drop the given params from the address bar without navigating, so the secret
 * isn't left in history, a screenshot or a copied link. Read the value into
 * state *before* calling this — useSearchParams() follows replaceState.
 */
export function stripParamsFromAddressBar(...names: string[]): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  let changed = false
  for (const name of names) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name)
      changed = true
    }
  }
  if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
}
