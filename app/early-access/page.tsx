import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { JetBrains_Mono, Sora } from "next/font/google"
import { Logo } from "@/components/landing/logo"
import { EarlyAccessForm } from "@/components/landing/early-access-form"
import { gatePassword, safeNext } from "@/lib/launch-gate"
import { landingThemeScript } from "@/components/landing/theme-toggle"
import "../landing.css"

const display = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-landing", display: "swap" })
const lcd = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-lcd", display: "swap" })

export const metadata: Metadata = {
  title: "Team access — Converszio",
  robots: { index: false, follow: false },
}

// Reads the gate env per request; must not be prerendered with a baked answer.
export const dynamic = "force-dynamic"

export default async function EarlyAccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams
  const next = safeNext(rawNext)

  // Launched: nothing to unlock.
  if (!gatePassword()) redirect(next)

  return (
    <div className={`${display.variable} ${lcd.variable} lp relative grid min-h-screen place-items-center overflow-hidden px-4 py-12`}>
      <script dangerouslySetInnerHTML={{ __html: landingThemeScript }} />
      <div aria-hidden="true" className="lp-grid absolute inset-0" />
      <div aria-hidden="true" className="lp-orb lp-drift-a left-[-10%] top-[-10%] size-[480px] bg-teal-500/25" />
      <div aria-hidden="true" className="lp-orb lp-drift-b bottom-[-15%] right-[-10%] size-[420px] bg-indigo-600/25" />

      <div className="lp-glow-border lp-rise relative w-full max-w-sm rounded-3xl bg-lp-elev p-8 shadow-[var(--lp-shadow)]">
        <Link href="/" aria-label="Converszio home" className="inline-block">
          <Logo />
        </Link>
        <p className="font-lcd mt-10 text-[0.65rem] tracking-[0.3em] text-lp-accent">RESTRICTED · PRE-LAUNCH</p>
        <h1 className="font-landing mt-2 text-3xl font-bold tracking-[-0.04em] text-lp-fg">Team access</h1>
        <p className="mt-2 text-sm text-lp-muted">Converszio hasn&apos;t launched yet. Enter the access password to continue.</p>
        <EarlyAccessForm next={next} />
        <p className="mt-8 text-sm text-lp-subtle">
          Not on the team?{" "}
          <Link href="/#join" className="font-medium text-lp-accent underline-offset-4 hover:underline">
            Join the waitlist
          </Link>
        </p>
      </div>
    </div>
  )
}
