"use client"

import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Clock,
  Facebook,
  LifeBuoy,
  Lock,
  MessageCircle,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { AuroraBackdrop } from "@/components/ui/surface"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { cn } from "@/lib/utils"

/**
 * What need to be at hand before Meta's window opens. Finding out halfway
 * through (no website, the number still on personal WhatsApp) is where people
 * abandon the popup, so it is said here, before the click.
 */
const NEEDS = [
  {
    icon: Facebook,
    title: "A Facebook account",
    detail: "Meta creates a business portfolio for you if you don't have one.",
  },
  {
    icon: Building2,
    title: "Your business name and website",
    detail: "Shown to customers on your WhatsApp profile.",
  },
  {
    icon: Smartphone,
    title: "A phone number for WhatsApp",
    detail: "One that can receive an SMS or call and isn't on WhatsApp — or your Business app number.",
  },
]

/**
 * The whole road to a first message in three stages. The setup checklist's
 * seven steps are the right detail once a number is connected; before that,
 * six of them are locked and only make the start look long.
 */
const PATH = [
  {
    icon: MessageCircle,
    title: "Connect WhatsApp",
    detail: "Link your number through Meta.",
  },
  {
    icon: Sparkles,
    title: "Get ready to send",
    detail: "Add contacts, get a message template approved and top up your wallet.",
  },
  {
    icon: Send,
    title: "Send your first message",
    detail: "Reply in the inbox or launch a broadcast.",
  },
]

/**
 * The dashboard for an account with no WhatsApp number yet. One job — connect
 * — with everything else in support of it: what to have ready, where it leads,
 * and where to get help. The connect button opens Meta's window from its own
 * click; nothing in between.
 */
export function FirstRunWelcome({
  firstName,
  onConnected,
}: {
  firstName?: string
  /** Fired once the user closes the success screen — the page swaps to the connected dashboard. */
  onConnected?: () => void
}) {
  return (
    <div className="space-y-6">
      <section className="relative isolate">
        <AuroraBackdrop className="rounded-xl" />
        <div className="relative z-10">
          <PageHeader
            className="mb-0"
            eyebrow="Getting started"
            title={firstName ? `Welcome, ${firstName}` : "Welcome aboard"}
            description="You're a few minutes from your first WhatsApp message. Start by connecting your number."
          />
        </div>
      </section>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">Step 1 of 3</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                About 3 minutes
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                Connect your WhatsApp number
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Sign in with Facebook in a secure Meta window, choose your business and verify your number.
                We register it on the WhatsApp Business Platform for you.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2">
              <ConnectWhatsAppButton size="lg" mode="new" className="w-full sm:w-auto" onDone={onConnected} />
              <ConnectWhatsAppButton
                label="My number is on the WhatsApp Business app"
                variant="link"
                size="sm"
                mode="coexistence"
                onDone={onConnected}
                className="h-auto px-0 text-sm"
                // Unconfigured, both fall back to the same link; one is enough.
                unconfiguredFallback="hide"
              />
            </div>

            <ul className="mt-auto flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
              <li className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Secure sign-in through Meta — we never see your password
              </li>
              <li className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                Official WhatsApp Business Platform
              </li>
            </ul>
          </div>

          <div className="border-t bg-muted/40 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">Have these ready</p>
            <ul className="mt-4 space-y-4">
              {NEEDS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-xs ring-1 ring-border/60">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/whatsapp/new"
              className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pop-ups blocked? Use step-by-step setup
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      <section aria-labelledby="first-run-path" className="space-y-3">
        <h2 id="first-run-path" className="text-sm font-medium">
          Your path to the first message
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {PATH.map(({ icon: Icon, title, detail }, i) => {
            const current = i === 0
            return (
              <li
                key={title}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex gap-3 rounded-xl border p-4",
                  current ? "border-primary/40 bg-primary-soft/40" : "bg-card/60"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {current ? <Icon className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", !current && "text-muted-foreground")}>
                    {title}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Want a hand?</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Our team can walk you through setup, or follow the guide at your own pace.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/support">
              <LifeBuoy className="mr-1.5 h-3.5 w-3.5" />
              Contact support
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/docs">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Read the guide
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
