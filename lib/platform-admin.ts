import { env } from "@/lib/env"

/**
 * Routes for features still mid-build (Revenue ledger, Store sync) — hidden
 * from customers and shown only to the emails in
 * NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS until development finishes and pricing
 * is decided. Not a security boundary: the backend doesn't gate these routes
 * the way AdminGuard gates app/admin/** , it's a nav/page visibility switch
 * only. Remove the gate (and this list) once the feature ships for real.
 */
export const PLATFORM_ADMIN_ONLY_PREFIXES = ["/dashboard/revenue", "/dashboard/integrations"]

const adminEmails = new Set(
  (env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails.has(email.toLowerCase())
}

export function isPlatformAdminOnlyRoute(pathname: string): boolean {
  return PLATFORM_ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
