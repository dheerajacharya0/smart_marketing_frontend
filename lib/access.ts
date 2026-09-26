/**
 * What each role may open, mirroring the backend's account-access rules
 * (backend-wb src/team/account-access.ts, applied per service):
 *
 *   member  — anyone on the account (owner, admin, agent): day-to-day work
 *   manager — owner or admin: money, integrations, credentials, setup
 *   owner   — the account's owner alone
 *
 * The backend is the gate; this only keeps the UI from offering doors that
 * answer 403. Keep the two in step — a route missing here is merely shown and
 * then refused, a route wrongly listed here hides something a person can use.
 */

export type AccountRole = "owner" | "admin" | "agent"
export type AccessLevel = "member" | "manager" | "owner"

/** Route prefixes above member level. Longest match wins; see `routeAccess`. */
const ROUTE_ACCESS: [prefix: string, level: AccessLevel][] = [
  ["/dashboard/billing", "manager"],
  ["/dashboard/api-usage", "manager"],
  ["/dashboard/notifications", "manager"],
  ["/dashboard/automation", "manager"],
  ["/dashboard/revenue", "manager"],
  ["/dashboard/whatsapp", "manager"],
  ["/dashboard/users", "owner"],
]

/**
 * Carve-outs under a restricted prefix: a WABA's templates live under
 * /dashboard/whatsapp but are everyday work, and the backend lets members in.
 */
const MEMBER_EXCEPTIONS = [/^\/dashboard\/whatsapp\/[^/]+\/templates(\/|$)/]

export function routeAccess(pathname: string): AccessLevel {
  if (MEMBER_EXCEPTIONS.some((re) => re.test(pathname))) return "member"
  let best: [string, AccessLevel] | null = null
  for (const entry of ROUTE_ACCESS) {
    const [prefix] = entry
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best[0].length) best = entry
    }
  }
  return best?.[1] ?? "member"
}

export function roleAllows(role: AccountRole, level: AccessLevel): boolean {
  if (level === "member") return true
  if (level === "manager") return role === "owner" || role === "admin"
  return role === "owner"
}

export function canOpen(role: AccountRole, pathname: string): boolean {
  return roleAllows(role, routeAccess(pathname))
}
