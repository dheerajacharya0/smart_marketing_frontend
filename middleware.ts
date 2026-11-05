import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { NONCE_HEADER, buildCsp, generateNonce, plaintextConnectOrigins } from "@/lib/csp"

/**
 * Two jobs, on every page request:
 *
 * 1. **Per-request CSP nonce** (lib/csp.ts). The policy goes on the request so
 *    Next stamps the nonce on its own scripts while rendering, and on the
 *    response so the browser enforces it. `x-nonce` carries it to our inline
 *    scripts via `getNonce()`.
 *
 *    Currently sent as **Report-Only**: violations show in the browser console
 *    but nothing is blocked, while the static enforced policy in next.config.mjs
 *    keeps protecting. Flip `CSP_HEADER` to "Content-Security-Policy" (and
 *    delete the next.config.mjs one) once production is clean.
 *
 * 2. **Edge auth guard** (Phase S #3) for /dashboard — defense-in-depth.
 *    This is the only guard that runs before the page does. What's left on the
 *    client is a fallback for the session marker expiring mid-visit (an effect
 *    in `app/dashboard/layout.tsx`), and that one deliberately renders the tree
 *    regardless — so an unauthenticated request has to be stopped here.
 *
 *    Gate on the `userData` UI session marker, not the JWT: the real httpOnly
 *    `access_token` cookie is set on the *backend* origin (cross-origin API), so
 *    it is not sent to the frontend and is invisible here. A stale marker still
 *    yields a clean 401 → login from the API layer, so this can't wrongly block
 *    an authorized user; the backend JWT remains the real gate.
 */
const CSP_HEADER = "Content-Security-Policy-Report-Only"

function isDashboard(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDashboard(pathname) && !request.cookies.has("userData")) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const nonce = generateNonce()
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    plaintextOrigins: plaintextConnectOrigins(
      process.env.NEXT_PUBLIC_API_BASE_URL,
      process.env.NEXT_PUBLIC_CHAT_WS_PORT,
      process.env.NEXT_PUBLIC_CHAT_WS_URL
    ),
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)
  // Always the *enforcing* name on the request, whatever CSP_HEADER is: this
  // copy is only for Next, which pulls the nonce out of it to stamp its own
  // scripts — the browser never sees request headers. On Vercel a
  // `content-security-policy-report-only` request header never reached the
  // renderer (prod HTML had un-nonced Next scripts while `x-nonce` arrived
  // fine), though it worked under local `next start`.
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(CSP_HEADER, csp)
  return response
}

export const config = {
  // Every page, not static files: build assets, the Sentry tunnel (a POST-only
  // API route), and anything with a file extension (fonts, images, sw.js,
  // robots.txt, sitemap.xml, manifest.webmanifest).
  matcher: ["/((?!_next/static|_next/image|monitoring|.*\\.[a-zA-Z0-9]+$).*)"],
}
