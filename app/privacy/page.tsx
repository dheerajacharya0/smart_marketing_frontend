import type { Metadata } from "next"
import Link from "next/link"
import { Sora } from "next/font/google"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/landing/logo"
import { landingThemeScript } from "@/components/landing/theme-toggle"
import { env } from "@/lib/env"
import "../landing.css"

const display = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-landing", display: "swap" })

export const metadata: Metadata = {
  title: "Privacy — Converszio",
  description: "What Converszio does with the email you leave on the waitlist.",
}

/**
 * Pre-launch privacy notice: covers the waitlist form only, which is all the
 * public site collects. Replace with the full policy before launch.
 */
export default function PrivacyPage() {
  const contact = env.NEXT_PUBLIC_SUPPORT_EMAIL
  return (
    <div className={`${display.variable} lp min-h-screen px-4 py-12 sm:px-8`}>
      <script dangerouslySetInnerHTML={{ __html: landingThemeScript }} />
      <div className="mx-auto max-w-2xl">
        <Link href="/" aria-label="Converszio home">
          <Logo />
        </Link>
        <h1 className="font-landing mt-12 text-4xl font-bold tracking-[-0.04em] text-lp-fg">Waitlist privacy notice</h1>
        <p className="mt-2 text-sm text-lp-subtle">Last updated 4 October 2026</p>

        <div className="mt-10 space-y-8 leading-relaxed text-lp-text">
          <section>
            <h2 className="font-landing text-xl font-semibold text-lp-fg">What we collect</h2>
            <p className="mt-2">
              When you join the waitlist we store your email address, which form you used, the time you signed up and your
              browser&apos;s user-agent. If you used the savings calculator first, we also store the monthly message count
              and savings figure it showed you.
            </p>
          </section>
          <section>
            <h2 className="font-landing text-xl font-semibold text-lp-fg">Why</h2>
            <p className="mt-2">
              To tell you when Converszio opens, and to understand roughly what size of business is interested. We
              don&apos;t sell your email, share it for marketing, or send you anything other than launch news.
            </p>
          </section>
          <section>
            <h2 className="font-landing text-xl font-semibold text-lp-fg">Removing your email</h2>
            <p className="mt-2">
              {contact ? (
                <>
                  Write to{" "}
                  <a href={`mailto:${contact}`} className="font-medium text-lp-accent underline-offset-4 hover:underline">
                    {contact}
                  </a>{" "}
                  and we&apos;ll delete it.
                </>
              ) : (
                <>Reply to any email from us and we&apos;ll delete it.</>
              )}{" "}
              Every launch email will also carry an unsubscribe link.
            </p>
          </section>
          <section>
            <h2 className="font-landing text-xl font-semibold text-lp-fg">Cookies</h2>
            <p className="mt-2">
              The public site sets no tracking cookies. It remembers your light/dark choice in your own browser&apos;s
              storage, which never leaves your device.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-lp-accent hover:underline">
          <ArrowLeft className="size-4" />
          Back to Converszio
        </Link>
      </div>
    </div>
  )
}
