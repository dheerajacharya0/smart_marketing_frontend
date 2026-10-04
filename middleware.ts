import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { GATE_COOKIE, gatePassword, gateToken, isPublicPath, safeEqual } from "@/lib/launch-gate"

/**
 * Two guards, in order:
 *
 * 1. Pre-launch gate (lib/launch-gate.ts). While SITE_ACCESS_PASSWORD is set,
 *    every route except the public landing page needs the `cz_access` cookie;
 *    pages redirect to /early-access, API routes answer 401. Unset the var to
 *    launch.
 *
 * 2. Edge auth guard (Phase S #3) — defense-in-depth for /dashboard.
 *
 *    This is the only guard that runs before the page does. What's left on the
 *    client is a fallback for the session marker expiring mid-visit (an effect
 *    in `app/dashboard/layout.tsx`), and that one deliberately renders the tree
 *    regardless — so an unauthenticated request has to be stopped here.
 *
 *    Gate on the `userData` UI session marker, not the JWT: the real httpOnly
 *    `access_token` cookie is set on the *backend* origin (cross-origin API), so
 *    it is not sent to the frontend and is invisible here. `userData` is set by
 *    the frontend on its own origin and mirrors login state. A stale marker
 *    still yields a clean 401 → login from the API layer, so this can't wrongly
 *    block an authorized user; the backend JWT remains the real gate.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const password = gatePassword()
  if (password && !isPublicPath(pathname)) {
    const cookie = request.cookies.get(GATE_COOKIE)?.value
    if (!cookie || !safeEqual(cookie, await gateToken(password))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not launched yet" }, { status: 401 })
      }
      const gateUrl = new URL("/early-access", request.url)
      gateUrl.searchParams.set("next", pathname + search)
      return NextResponse.redirect(gateUrl)
    }
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!request.cookies.has("userData")) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Everything but static assets, the Sentry tunnel and the files browsers
  // fetch on their own (icons, manifest, service worker) — the gate has to see
  // every page, the dashboard guard filters to /dashboard itself.
  matcher: [
    "/((?!_next/static|_next/image|monitoring|icon|apple-icon|manifest\\.webmanifest|sw\\.js|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)",
  ],
}
