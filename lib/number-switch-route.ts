/**
 * Where to go when the active number changes while a page is open.
 *
 * Most pages read the active number on mount, and the dashboard layout
 * re-mounts them on a switch, so they follow on their own. A few carry a
 * number-scoped id in the URL instead, and re-mounting just re-reads the old
 * one: the templates screen (`?wabaId=` of the previous number) kept showing
 * the first number's templates, and an open chat kept showing the previous
 * number's thread while replies went out from the new one. Those go back to
 * their list, which resolves the new number.
 *
 * Returns null when the current page follows the switch by itself.
 */
export function routeAfterNumberSwitch(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  if (/^\/dashboard\/whatsapp\/[^/]+\/templates(\/|$)/.test(pathname)) return "/dashboard/templates"
  if (/^\/dashboard\/chat\/(?!new(\/|$))[^/]+/.test(pathname)) return "/dashboard/chat"
  // Campaigns, drips and chatbot flows each belong to one number; their lists
  // now show only the active number's, so an open one goes back to its list.
  const owned = /^\/dashboard\/(campaigns|drips|flows)\/(?!new(\/|$))[^/]+/.exec(pathname)
  if (owned) return `/dashboard/${owned[1]}`
  // A form lives on one WABA; the new number may be on another.
  if (/^\/dashboard\/whatsapp-flows\/[^/]+/.test(pathname)) return "/dashboard/whatsapp-flows"
  return null
}
