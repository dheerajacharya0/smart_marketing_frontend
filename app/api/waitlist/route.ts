import { NextResponse } from "next/server"
import { z } from "zod"

/**
 * Pre-launch waitlist. There is no backend table for this; each signup is
 * forwarded as JSON to WAITLIST_WEBHOOK_URL (a Google Apps Script, Zapier,
 * Make or Slack incoming webhook — anything that accepts a POST).
 *
 * Unset in production, signups are refused with a 503 rather than accepted
 * and dropped: telling someone "you're on the list" when they aren't is worse
 * than an error they can see.
 */

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  /** Honeypot: hidden from people, filled by bots. */
  company: z.string().optional(),
  source: z.string().max(40).optional(),
  monthlyMessages: z.number().int().nonnegative().max(1e9).optional(),
  monthlySavings: z.number().nonnegative().max(1e10).optional(),
})

export async function POST(request: Request) {
  let parsed: z.infer<typeof schema>
  try {
    const result = schema.safeParse(await request.json())
    if (!result.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }
    parsed = result.data
  } catch {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
  }

  // Bot filled the hidden field: answer like success, store nothing.
  if (parsed.company) return NextResponse.json({ ok: true })

  const entry = {
    email: parsed.email,
    source: parsed.source ?? "landing",
    monthlyMessages: parsed.monthlyMessages ?? null,
    monthlySavings: parsed.monthlySavings ?? null,
    createdAt: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") ?? "",
  }

  const webhook = process.env.WAITLIST_WEBHOOK_URL
  if (!webhook) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[waitlist] WAITLIST_WEBHOOK_URL unset; would have stored:", entry)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Signups aren't open yet. Please try again soon." }, { status: 503 })
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`webhook answered ${res.status}`)
  } catch (err) {
    console.error("[waitlist] forward failed", err)
    return NextResponse.json({ error: "Couldn't save your email. Please try again." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
