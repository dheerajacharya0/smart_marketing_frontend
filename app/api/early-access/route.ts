import { NextResponse } from "next/server"
import { GATE_COOKIE, GATE_COOKIE_MAX_AGE, gatePassword, gateToken, safeEqual } from "@/lib/launch-gate"

/** Unlocks the pre-launch gate: right password in, `cz_access` cookie out. */
export async function POST(request: Request) {
  const password = gatePassword()
  if (!password) return NextResponse.json({ ok: true })

  let attempt = ""
  try {
    const body = (await request.json()) as { password?: unknown }
    if (typeof body.password === "string") attempt = body.password
  } catch {
    // Malformed body reads as a wrong password.
  }

  const expected = await gateToken(password)
  if (!attempt || !safeEqual(await gateToken(attempt), expected)) {
    // Slows a guessing loop without a rate-limit store.
    await new Promise((resolve) => setTimeout(resolve, 600))
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE,
  })
  return response
}
