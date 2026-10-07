import type { Metadata } from "next"
import Link from "next/link"
import { JetBrains_Mono, Sora } from "next/font/google"
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  CreditCard,
  Inbox,
  Infinity as InfinityIcon,
  Mail,
  Megaphone,
  Plug,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  Workflow,
} from "lucide-react"
import { env } from "@/lib/env"
import { Faq } from "@/components/landing/faq"
import { Logo } from "@/components/landing/logo"
import { WaitlistForm } from "@/components/landing/waitlist-form"
import { Calculator } from "@/components/landing/calculator"
import { UseCases } from "@/components/landing/use-cases"
import { PhoneChat } from "@/components/landing/phone"
import { ScratchInvoice } from "@/components/landing/scratch-invoice"
import { ThemeToggle, landingThemeScript } from "@/components/landing/theme-toggle"
import { Magnetic, Reveal, ScrambleWords, SplitHeading, SpotlightCard, TiltStage } from "@/components/landing/effects"
import { Broadcast, CampaignFunnel, JourneyLine, PillarVisual } from "@/components/landing/marketing-motion"
import { Playground } from "@/components/landing/playground"
import { Delights } from "@/components/landing/delights"
import { ShareOnWhatsApp } from "@/components/landing/share-whatsapp"
import { USE_CASES } from "@/components/landing/use-cases-data"
import { META_RATES_INR } from "@/lib/savings"
import "./landing.css"

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-landing", display: "swap" })
const lcd = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-lcd", display: "swap" })

export const metadata: Metadata = {
  title: "Converszio — Campaigns, follow-ups and customer conversations together",
  description:
    "Converszio is a WhatsApp marketing tool that helps businesses manage campaigns, automate follow-ups and organize customer conversations, with reporting that connects marketing activity to sales evidence. Launching soon.",
  openGraph: {
    title: "Converszio — Better conversations. More opportunities.",
    description: "Run targeted WhatsApp campaigns, automate follow-ups and help your team manage customer enquiries with context.",
    type: "website",
  },
}

const ROW_A = [
  "Abandoned cart recovery",
  "COD confirmation",
  "Diwali & festive campaigns",
  "Appointment reminders",
  "Invoice reminders",
  "Login OTPs",
]
const ROW_B = [
  "Order tracking",
  "Back-in-stock alerts",
  "Feedback & reviews",
  "Lead follow-ups",
  "Click-to-WhatsApp ads",
  "Shared team inbox",
]

/** Decoded one after another under the hero headline. */
const ROTATING = ["Diwali offer.", "cart reminder.", "follow-up.", "order update.", "customer reply."]

/**
 * Campaign events rising behind the hero — what a business sees happen once
 * it starts using Converszio: [label, left %, duration s, delay s, drift px].
 */
const PARTICLES: [string, number, number, number, number][] = [
  ["📣 Campaign sent", 51, 12, 0, 15],
  ["✓✓ Read", 56, 9.5, 5.5, -10],
  ["🛒 Cart recovered", 61, 12.5, 7, -20],
  ["↩ Replied", 66, 10, 2.5, 15],
  ["🔁 Follow-up sent", 71, 11, 4.5, 20],
  ["🎯 Segment: VIP", 76, 10.5, 9, -15],
  ["📦 Order update", 81, 11.5, 1.2, 15],
  ["💬 New enquiry", 86, 9, 6.2, -25],
  ["🪔 Diwali offer", 91, 12, 3.4, 10],
  ["📈 Sale attributed", 95, 13, 8.2, -20],
]

/** The three messaging pillars from the brand guide. */
const PILLARS = [
  {
    icon: Megaphone,
    visual: "reach" as const,
    t: "Reach with relevance",
    d: "Send useful messages to the right customer groups.",
    points: ["Targeted WhatsApp campaigns", "Segments built from your contacts", "AI-assisted template drafting"],
  },
  {
    icon: Workflow,
    visual: "follow" as const,
    t: "Follow up consistently",
    d: "Keep enquiries moving with repeatable journeys.",
    points: ["Drip sequences on a schedule", "Follow-ups that respond to customer replies", "WhatsApp Flows forms inside the chat"],
  },
  {
    icon: Inbox,
    visual: "clarity" as const,
    t: "Work with clarity",
    d: "Keep conversations and campaign results visible.",
    points: ["One shared inbox for the whole team", "Attributed sales alongside campaign costs", "The Meta cost of every message, shown openly"],
  },
]

const STEPS = [
  { icon: Smartphone, t: "Connect your number", d: "Link your WhatsApp Business number through Meta's own Embedded Signup — a few clicks, no paperwork with us." },
  { icon: Users, t: "Bring your customers", d: "Import your contacts, then group them into segments." },
  { icon: Send, t: "Run campaigns and follow up", d: "Launch a campaign, a drip or an automated flow, and see what every message cost at Meta." },
]

/**
 * Feature groups, named as the brand guide recommends. Only what the product
 * ships today; anything not yet generally available carries its status.
 */
const FEATURE_GROUPS: { icon: typeof Megaphone; t: string; items: { name: string; status?: string }[] }[] = [
  { icon: Megaphone, t: "Campaigns and Marketing", items: [{ name: "Targeted campaigns" }, { name: "Segments" }, { name: "Template library" }] },
  { icon: Workflow, t: "Automation and Follow-ups", items: [{ name: "Drip sequences" }, { name: "Automation flows" }, { name: "WhatsApp Flows" }] },
  { icon: Inbox, t: "Inbox and Customer Engagement", items: [{ name: "Shared team inbox" }, { name: "WhatsApp calling" }] },
  { icon: BarChart3, t: "Revenue and Performance", items: [{ name: "Tracked links" }, { name: "Attributed sales and campaign costs" }] },
  { icon: Plug, t: "Commerce and Integrations", items: [{ name: "Shopify sync", status: "In QA" }, { name: "API and webhooks" }] },
  { icon: ShieldCheck, t: "Trust and Administration", items: [{ name: "Team invites and roles" }, { name: "Number health alerts" }] },
]

const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL || ""

const heroScript = USE_CASES[0]

const H2 = "font-landing mt-4 text-[clamp(1.75rem,3.4vw,2.25rem)] font-bold leading-[1.12] tracking-[-0.03em] text-lp-fg"

export default function Home() {
  return (
    <div className={`${display.variable} ${lcd.variable} lp relative min-h-screen overflow-x-clip`}>
      <script dangerouslySetInnerHTML={{ __html: landingThemeScript }} />
      <Delights />
      <div aria-hidden="true" className="lp-progress-beam fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500" />

      {/* Backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[1200px] overflow-hidden">
        <div className="lp-grid absolute inset-0" />
        <div className="lp-orb lp-drift-a left-[-10%] top-[-12%] size-[620px] bg-blue-500/25" />
        <div className="lp-orb lp-drift-b right-[-12%] top-[8%] size-[560px] bg-teal-500/25" />
        <div className="lp-orb lp-drift-a left-[35%] top-[45%] size-[420px] bg-blue-400/10" />
      </div>
      <div aria-hidden="true" className="lp-noise pointer-events-none fixed inset-0 z-[1]" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-lp-line bg-lp-nav backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" aria-label="Converszio home">
            <Logo priority />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-lp-muted md:flex lg:gap-8">
            <a href="#try" className="py-3 font-semibold text-lp-accent transition hover:text-lp-fg">Try it</a>
            <a href="#product" className="py-3 transition hover:text-lp-fg">Product</a>
            <a href="#use-cases" className="py-3 transition hover:text-lp-fg">Use cases</a>
            <a href="#pricing" className="py-3 transition hover:text-lp-fg">Pricing</a>
            <a href="#faq" className="py-3 transition hover:text-lp-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Magnetic>
              <a
                href="#join"
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lp-btn px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-lp-btn-hover sm:px-4"
              >
                Join waitlist
                <ArrowRight className="hidden size-3.5 transition-transform group-hover:translate-x-0.5 sm:block" />
              </a>
            </Magnetic>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <TiltStage className="relative">
          <div aria-hidden="true" className="lp-cursor-glow pointer-events-none absolute inset-0" />
          {/* Desktop and tablet only: phones get the same story with less work. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
            {PARTICLES.map(([label, left, dur, delay, dx], i) => (
              <span
                key={i}
                className="lp-particle whitespace-nowrap rounded-full border border-lp-line bg-lp-elev px-2.5 py-1 text-xs font-semibold text-lp-text shadow-sm"
                style={{ left: `${left}%`, ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ["--dx" as string]: `${dx}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-28">
            <div>
              <div className="lp-rise inline-flex items-center gap-2.5 rounded-full border border-lp-line bg-lp-card py-1.5 pl-2 pr-4">
                <span className="relative flex size-2.5">
                  <span className="lp-pulse-ring absolute inset-0 rounded-full bg-lp-teal" />
                  <span className="relative size-2.5 rounded-full bg-lp-teal" />
                </span>
                <span className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-lp-teal">Invite-only beta</span>
              </div>

              <h1
                className="lp-rise font-landing mt-7 max-w-2xl text-[clamp(2rem,4.4vw,3rem)] font-bold leading-[1.1] tracking-[-0.035em] text-lp-fg"
                style={{ animationDelay: "100ms" }}
              >
                Bring campaigns, follow-ups and customer conversations <span className="lp-gradient-text lp-shimmer">together.</span>
              </h1>

              <p
                className="lp-rise font-landing mt-5 text-[clamp(1.25rem,2.2vw,1.6rem)] font-semibold tracking-[-0.02em] text-lp-fg"
                style={{ animationDelay: "160ms" }}
              >
                One workflow for every{" "}
                <ScrambleWords words={ROTATING} className="lp-gradient-text lp-shimmer inline-block min-h-[1.2em]" />
              </p>

              <p className="lp-rise mt-5 max-w-xl text-lg leading-relaxed text-lp-muted" style={{ animationDelay: "220ms" }}>
                Run targeted WhatsApp campaigns, automate follow-ups and help your team manage customer enquiries with context.
              </p>

              <div className="lp-rise mt-9 max-w-lg" style={{ animationDelay: "300ms" }}>
                <WaitlistForm source="hero" />
              </div>

              <div className="lp-rise mt-7" style={{ animationDelay: "380ms" }}>
                <Magnetic strength={0.2}>
                  <a href="#product" className="group inline-flex items-center gap-3 text-[0.95rem] font-semibold text-lp-fg transition hover:text-lp-accent">
                    <span className="grid size-10 place-items-center rounded-full border border-lp-line-strong bg-lp-elev transition group-hover:border-lp-accent-line group-hover:bg-lp-accent-soft">
                      <ArrowDown className="size-4 animate-bounce text-lp-accent" />
                    </span>
                    Explore Converszio
                  </a>
                </Magnetic>
              </div>

              <div className="lp-rise mt-10 flex flex-wrap items-center gap-2 text-sm text-lp-muted" style={{ animationDelay: "460ms" }}>
                <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-lp-subtle">Built on</span>
                {["WhatsApp Cloud API", "Meta Embedded Signup"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-lp-line bg-lp-card px-3 py-1.5">
                    <Check className="size-3.5 text-lp-teal" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="lp-rise relative mx-auto hidden md:block" style={{ animationDelay: "250ms" }}>
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/30 via-blue-400/10 to-teal-400/30 blur-3xl" />
              <Broadcast />
              <div className="lp-tilt">
                <div className="lp-float">
                  <PhoneChat business={heroScript.business} script={heroScript.script} />
                </div>
              </div>
              <CampaignFunnel className="absolute -left-32 bottom-6 z-20 hidden xl:block" />
              <FloatingChip className="-right-24 top-[34%] hidden xl:flex" delay="1.2s" dot="bg-teal-500">
                ↩ Priya replied · <b className="text-lp-fg">Complete my order</b>
              </FloatingChip>
              <FloatingChip className="-right-28 top-[64%] hidden xl:flex" delay="2.4s" dot="bg-blue-500">
                🔁 Follow-up queued · <b className="text-lp-accent">if no reply in 1 day</b>
              </FloatingChip>
            </div>
          </section>
        </TiltStage>

        {/* Marquee */}
        <div className="lp-marquee-mask relative space-y-4 border-y border-lp-line bg-lp-card py-5">
          {[ROW_A, ROW_B].map((row, r) => (
            <div key={r} className={`lp-marquee flex w-max gap-10 ${r === 1 ? "lp-marquee-rev" : ""}`}>
              {[...row, ...row, ...row].map((item, i) => (
                <span key={i} className="flex items-center gap-10 whitespace-nowrap text-sm font-medium text-lp-muted">
                  {item}
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${i % 2 ? "bg-lp-teal" : "bg-lp-accent"} opacity-70`} />
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Playground */}
        <section id="try" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-8 sm:py-28">
          <div className="mb-12 max-w-2xl">
            <Eyebrow>Try it · no signup</Eyebrow>
            <SplitHeading text="Don't read about it." accent="Send one." className={H2} />
            <Reveal delay={150}>
              <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                Type your business name, pick a moment, and watch your first WhatsApp campaign land — and get a reply.
              </p>
            </Reveal>
          </div>
          <Playground />
        </section>

        {/* Pillars */}
        <section id="product" className="mx-auto max-w-7xl scroll-mt-20 border-t border-lp-line px-4 py-24 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <Eyebrow>What Converszio does</Eyebrow>
            <SplitHeading text="Turn customer conversations into" accent="business opportunities." className={H2} />
            <Reveal delay={150}>
              <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                Converszio brings campaigns, follow-ups and team conversations into one organized workflow, supported by clear
                reporting.
              </p>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, visual, t, d, points }, i) => (
              <Reveal key={t} delay={i * 120}>
                <SpotlightCard className="group h-full p-7">
                  <PillarVisual kind={visual} />
                  <div className="mt-6 flex items-center gap-3">
                    <IconTile icon={Icon} />
                    <h3 className="font-landing text-xl font-semibold text-lp-fg">{t}</h3>
                  </div>
                  <p className="mt-2 text-lp-muted">{d}</p>
                  <ul className="mt-5 space-y-2.5">
                    {points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[0.95rem] text-lp-text">
                        <Check className="mt-0.5 size-4 shrink-0 text-lp-teal" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="relative scroll-mt-20 border-t border-lp-line">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-28">
            <div className="max-w-2xl">
              <Eyebrow>Real campaigns, real chats</Eyebrow>
              <SplitHeading text="Keep every customer" accent="enquiry moving." className={H2} />
              <Reveal delay={150}>
                <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                  Journeys Indian businesses already run on WhatsApp — tap one and watch it play out.
                </p>
              </Reveal>
            </div>
            <Reveal delay={120} className="mt-14">
              <UseCases />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-8 sm:pb-28">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <SplitHeading text="From sign-up to first campaign" accent="in one sitting." className={H2} />
          </div>
          <JourneyLine />
          <div className="mt-12 grid gap-4 md:mt-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 120}>
                <SpotlightCard className="group h-full p-6">
                  <div className="flex items-center gap-3">
                    <IconTile icon={Icon} />
                    <span className="font-lcd text-sm font-bold text-lp-subtle">0{i + 1}</span>
                  </div>
                  <h3 className="font-landing mt-5 text-xl font-semibold text-lp-fg">{t}</h3>
                  <p className="mt-2 text-lp-muted">{d}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing: scratch reveal */}
        <section id="pricing" className="relative scroll-mt-20 border-t border-lp-line">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-28">
            <div className="grid items-center gap-16 lg:grid-cols-[1fr_auto]">
              <div className="max-w-xl">
                <Eyebrow>Transparent pricing</Eyebrow>
                <SplitHeading text="Meta's charges and our fee," accent="kept separate." className={H2} />
                <Reveal delay={150}>
                  <p className="mt-6 text-lg leading-relaxed text-lp-muted">
                    A WhatsApp tool&apos;s bill usually shows a plan and &ldquo;message charges&rdquo;. With many tools, those
                    charges are Meta&apos;s price <em>plus</em> a markup. Scratch the silver strip to see where it sits.
                  </p>
                  <ol className="mt-8 space-y-4">
                    {[
                      ["01", "Meta sets the price of every message."],
                      ["02", "Many tools resell it with a markup included."],
                      ["03", "With Converszio, Meta bills you directly, so there is no markup line."],
                    ].map(([n, t]) => (
                      <li key={n} className="flex items-start gap-4">
                        <span className="font-lcd mt-0.5 text-sm font-bold text-lp-accent">{n}</span>
                        <span className="text-lp-text">{t}</span>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              </div>
              <Reveal delay={200}>
                <ScratchInvoice />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="relative scroll-mt-20 border-y border-lp-line bg-lp-card">
          <div aria-hidden="true" className="lp-orb lp-drift-b left-[-8%] top-[20%] size-[480px] bg-blue-500/10" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-28">
            <div className="max-w-2xl">
              <Eyebrow>Savings calculator</Eyebrow>
              <SplitHeading text="Enter your monthly messages." accent="Compare the cost." className={H2} />
              <Reveal delay={150}>
                <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                  Other tools charge a monthly plan <em>and</em> a markup on every message. With Converszio you pay Meta
                  directly, with no markup on messages.
                </p>
              </Reveal>
            </div>
            <Reveal delay={120} className="mt-14">
              <Calculator />
            </Reveal>
            <p className="mt-10 max-w-3xl text-xs leading-relaxed text-lp-subtle">
              Meta rates: India, per delivered message, before 18% GST — marketing ₹0.8631, utility and authentication ₹0.115.
              Competitor figures use each tool&apos;s entry paid plan from its public pricing page and estimated markups on
              Meta&apos;s rate; actual plans, seat fees and markups vary. Service conversations and other countries are not
              included. Estimates only.
            </p>
          </div>
        </section>

        {/* Why */}
        <section id="why" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-8 sm:py-28">
          <Eyebrow>Why Converszio</Eyebrow>
          <SplitHeading text="Clear costs." accent="Shared work." className={`${H2} max-w-2xl`} />

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Reveal className="md:col-span-2">
              <SpotlightCard className="h-full p-7 sm:p-9">
                <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-landing lp-gradient-text text-[5rem] font-bold leading-none tracking-[-0.05em] sm:text-[6.5rem]">0%</p>
                    <p className="font-landing mt-2 text-2xl font-semibold text-lp-fg">markup on Meta&apos;s message price</p>
                    <p className="mt-2 max-w-sm text-lp-muted">Meta bills your own card at Meta&apos;s price. We don&apos;t add anything on top of a message.</p>
                  </div>
                  <div className="font-lcd w-full max-w-[260px] rounded-2xl border border-lp-line bg-lp-elev p-4 text-xs">
                    <p className="tracking-[0.2em] text-lp-subtle">PER MARKETING MESSAGE</p>
                    <div className="mt-3 space-y-2 text-lp-text">
                      <div className="flex justify-between"><span>Meta charges</span><span>₹{META_RATES_INR.marketing}</span></div>
                      <div className="flex justify-between"><span>Converszio adds</span><span className="text-lp-teal">₹0.0000</span></div>
                      <div className="flex justify-between border-t border-dashed border-lp-line-strong pt-2 font-bold text-lp-fg"><span>You pay</span><span>₹{META_RATES_INR.marketing}</span></div>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={100}>
              <SpotlightCard className="group h-full p-7 sm:p-9">
                <InfinityIcon className="size-14 text-lp-accent transition-transform duration-700 group-hover:rotate-180" strokeWidth={1.5} />
                <h3 className="font-landing mt-6 text-2xl font-semibold text-lp-fg">Unlimited seats</h3>
                <p className="mt-2 text-lp-muted">Your whole team in one inbox. Grow headcount without growing the bill.</p>
              </SpotlightCard>
            </Reveal>

            <Reveal>
              <SpotlightCard className="group h-full p-7 sm:p-9">
                <CreditCard className="size-10 text-lp-accent transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" strokeWidth={1.5} />
                <h3 className="font-landing mt-6 text-2xl font-semibold text-lp-fg">Pay Meta directly</h3>
                <p className="mt-2 text-lp-muted">No prepaid wallets, no locked balances. Your messages, your card, Meta&apos;s invoice.</p>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={100} className="md:col-span-2">
              <SpotlightCard className="h-full p-7 sm:p-9">
                <h3 className="font-landing text-2xl font-semibold text-lp-fg">Everything in one workflow</h3>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {FEATURE_GROUPS.map(({ icon: Icon, t, items }) => (
                    <div key={t} className="group rounded-2xl border border-lp-line bg-lp-elev p-4 transition hover:-translate-y-1 hover:border-lp-accent-line">
                      <Icon className="size-5 text-lp-accent transition-transform group-hover:scale-125" />
                      <p className="mt-3 font-semibold text-lp-fg">{t}</p>
                      <ul className="mt-2 space-y-1 text-sm text-lp-muted">
                        {items.map(({ name, status }) => (
                          <li key={name}>
                            {name}
                            {status && (
                              <span className="ml-1.5 rounded-full border border-lp-line-strong px-1.5 py-px text-[0.7rem] font-semibold text-lp-subtle">
                                {status}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 pb-24 sm:px-8 sm:pb-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <SplitHeading text="Questions," accent="answered plainly." className={H2} />
            <Reveal delay={150}>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-lp-muted">
                Zero markup raises fair questions. Here are straight answers.
              </p>
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="mt-6 inline-flex items-center gap-2 py-2 font-semibold text-lp-accent underline-offset-4 hover:underline"
                >
                  <Mail className="size-4" />
                  Something else? Write to us
                </a>
              )}
            </Reveal>
          </div>
          <Reveal delay={100}>
            <Faq />
          </Reveal>
        </section>

        {/* Join */}
        <section id="join" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-24 sm:px-8">
          <Reveal>
            <div className="lp-glow-border relative overflow-hidden rounded-[2.5rem] bg-lp-elev px-6 py-20 text-center shadow-[var(--lp-shadow)] sm:px-12 sm:py-28">
              <div aria-hidden="true" className="lp-grid absolute inset-0 opacity-60" />
              <div aria-hidden="true" className="lp-orb lp-drift-a left-[calc(50%-230px)] top-[-230px] size-[460px] bg-blue-500/25" />
              <div aria-hidden="true" className="lp-orb lp-drift-b bottom-[-30%] right-[-10%] size-[380px] bg-teal-500/25" />
              <div className="relative">
                <Eyebrow>Early access</Eyebrow>
                <SplitHeading
                  text="Better conversations."
                  accent="More opportunities."
                  className="font-landing mx-auto mt-5 max-w-3xl text-[clamp(2rem,4.4vw,3rem)] font-bold leading-[1.1] tracking-[-0.035em] text-lp-fg"
                />
                <p className="mx-auto mt-5 max-w-md text-lp-muted">
                  We&apos;re letting a small group in first. Leave your email and we&apos;ll save you a seat.
                </p>
                <div className="mx-auto mt-10 max-w-lg text-left">
                  <WaitlistForm source="footer" cta="Save my seat" />
                </div>
                <ShareOnWhatsApp className="mt-8" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-lp-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-lp-subtle sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#faq" className="py-2.5 transition hover:text-lp-fg">FAQ</a>
            <Link href="/privacy" className="py-2.5 transition hover:text-lp-fg">Privacy</Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="py-2.5 transition hover:text-lp-fg">Contact</a>
            )}
            <Link href="/early-access" className="py-2.5 transition hover:text-lp-fg">Team access</Link>
          </nav>
          <div className="md:text-right">
            <p>© {new Date().getFullYear()} Converszio. WhatsApp is a trademark of Meta Platforms, Inc.</p>
            <p className="mt-1 text-xs opacity-70">Psst — type &ldquo;diwali&rdquo; anywhere on this page.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.18em] text-lp-teal">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-current" />
      {children}
    </p>
  )
}

function IconTile({ icon: Icon }: { icon: typeof Megaphone }) {
  return (
    <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110">
      <Icon className="size-5" />
    </span>
  )
}

function FloatingChip({ children, className, delay, dot }: { children: React.ReactNode; className?: string; delay: string; dot: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ animationDelay: delay }}
      className={`lp-chip absolute z-10 items-center gap-2 whitespace-nowrap rounded-full border border-lp-line bg-lp-elev px-3.5 py-2 text-xs text-lp-text shadow-[0_10px_30px_-10px_rgba(13,15,20,0.35)] ${className ?? ""}`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
      {children}
    </div>
  )
}
