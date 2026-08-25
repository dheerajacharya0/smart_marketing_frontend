import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Edge auth guard (Phase S #3) — defense-in-depth.
 *
 * This is the only guard that runs before the page does. What's left on the
 * client is a fallback for the session marker expiring mid-visit (an effect in
 * `app/dashboard/layout.tsx`), and that one deliberately renders the tree
 * regardless — so an unauthenticated request has to be stopped here.
 *
 * Gate on the `userData` UI session marker, not the JWT: the real httpOnly
 * `access_token` cookie is set on the *backend* origin (cross-origin API), so
 * it is not sent to the frontend and is invisible here. `userData` is set by
 * the frontend on its own origin and mirrors login state. A stale marker still
 * yields a clean 401 → login from the API layer, so this can't wrongly block an
 * authorized user; the backend JWT remains the real gate.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("userData")

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Guard the authenticated area only. Auth pages and public routes are excluded
  // by not being listed here.
  matcher: ["/dashboard/:path*"],
}
