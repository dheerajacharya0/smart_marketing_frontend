import type React from "react"
import Link from "next/link"
import { Sora } from "next/font/google"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/landing/logo"
import { landingThemeScript } from "@/components/landing/theme-toggle"
import { env } from "@/lib/env"
import "@/app/landing.css"

const display = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-landing", display: "swap" })

/** The business behind Converszio, as verified with Meta. */
export const LEGAL_ENTITY = "The Dievision Infotech"

/**
 * Where legal and data requests go. The support address when one is
 * configured; otherwise the contact address registered on the Meta app, so the
 * pages Meta reviews always name a mailbox that is read.
 */
export function legalContactEmail(): string {
  return env.NEXT_PUBLIC_SUPPORT_EMAIL || "dievision.tarun@gmail.com"
}

/** Shared frame for /privacy, /terms and /data-deletion: public, gate-free, landing-styled. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  /** Human date, e.g. "8 October 2026". */
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className={`${display.variable} lp min-h-screen px-4 py-12 sm:px-8`}>
      <script dangerouslySetInnerHTML={{ __html: landingThemeScript }} />
      <div className="mx-auto max-w-2xl">
        <Link href="/" aria-label="Converszio home">
          <Logo />
        </Link>
        <h1 className="font-landing mt-12 text-4xl font-bold tracking-[-0.04em] text-lp-fg">{title}</h1>
        <p className="mt-2 text-sm text-lp-subtle">Last updated {updated}</p>

        <div className="mt-10 space-y-8 leading-relaxed text-lp-text">{children}</div>

        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-sm text-lp-subtle">
          <Link href="/privacy" className="hover:text-lp-fg">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-lp-fg">
            Terms
          </Link>
          <Link href="/data-deletion" className="hover:text-lp-fg">
            Data deletion
          </Link>
        </nav>

        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-lp-accent hover:underline">
          <ArrowLeft className="size-4" />
          Back to Converszio
        </Link>
      </div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-landing text-xl font-semibold text-lp-fg">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  )
}

export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="font-medium text-lp-accent underline-offset-4 hover:underline">
      {email}
    </a>
  )
}
