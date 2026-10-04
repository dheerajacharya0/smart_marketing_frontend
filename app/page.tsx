import type { Metadata } from "next"
import Link from "next/link"
import { JetBrains_Mono, Sora } from "next/font/google"
import {
  ArrowDown,
  ArrowRight,
  ClipboardList,
  Code2,
  CreditCard,
  Infinity as InfinityIcon,
  Inbox,
  LineChart,
  Mail,
  Megaphone,
  PhoneCall,
  Send,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
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
import { USE_CASES } from "@/components/landing/use-cases-data"
import { COMPETITORS, META_RATES_INR } from "@/lib/savings"
import "./landing.css"

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-landing", display: "swap" })
const lcd = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-lcd", display: "swap" })

export const metadata: Metadata = {
  title: "Converszio — Stop paying a tax on every WhatsApp message",
  description:
    "Most WhatsApp tools add a 12–26% markup on Meta's price plus a monthly plan. Converszio adds nothing. Scratch your invoice and see what you're overpaying. Launching soon.",
  openGraph: {
    title: "Converszio — Stop paying a tax on every WhatsApp message",
    description: "WhatsApp marketing at Meta's price. Zero markup, unlimited seats. See your hidden markup in 10 seconds.",
    type: "website",
  },
}

const ROW_A = [
  "Abandoned cart recovery",
  "COD confirmation",
  "Diwali & festive broadcasts",
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

const ROTATING = ["broadcast.", "order update.", "OTP.", "Diwali offer.", "cart reminder."]

/** Rising tokens behind the hero: [label, left %, duration s, delay s, drift px]. */
const PARTICLES: [string, number, number, number, number][] = [
  ["₹0 markup", 6, 11, 0, 30],
  ["✓✓", 18, 9, 2.5, -20],
  ["₹", 29, 8, 5, 15],
  ["💬", 41, 12, 1, -25],
  ["₹0.86", 52, 10, 6.5, 20],
  ["🛒", 63, 9.5, 3.2, -15],
  ["✓✓", 72, 11, 7.4, 25],
  ["₹", 81, 8.5, 0.8, -30],
  ["🪔", 90, 12, 4.4, 10],
  ["₹2,249", 12, 13, 8, -10],
  ["💬", 47, 10.5, 9.5, 30],
  ["₹", 95, 9, 10.5, -20],
]

const STEPS = [
  { icon: Smartphone, t: "Connect your number", d: "Link your WhatsApp Business number through Meta's own Embedded Signup — a few clicks, no paperwork with us." },
  { icon: Users, t: "Bring your customers", d: "Import contacts or sync your Shopify store, then group them into segments." },
  { icon: Send, t: "Send and sell", d: "Launch a broadcast, a drip or an automated flow, and see what every message cost at Meta." },
]

/** Only what the product actually ships today. */
const FEATURES = [
  { icon: Inbox, t: "Shared team inbox", d: "Every chat, every agent, one screen." },
  { icon: Megaphone, t: "Campaigns & drips", d: "Broadcasts, segments and timed sequences." },
  { icon: Workflow, t: "Automation flows", d: "Replies and routing that run while you sleep." },
  { icon: ClipboardList, t: "WhatsApp Flows", d: "Forms and bookings inside the chat." },
  { icon: ShoppingBag, t: "Shopify sync", d: "Orders and customers, always up to date." },
  { icon: LineChart, t: "Revenue tracking", d: "Tracked links that tie sales to messages." },
  { icon: PhoneCall, t: "WhatsApp calling", d: "Talk to customers without leaving the inbox." },
  { icon: Code2, t: "API & webhooks", d: "Plug Converszio into your own stack." },
  { icon: Sparkles, t: "Template library", d: "Start from ready-made, approval-friendly templates." },
]

const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL || ""

const heroScript = USE_CASES[0]
const priciest = Math.max(...COMPETITORS.map((c) => c.markup))

export default function Home() {
  return (
    <div className={`${display.variable} ${lcd.variable} lp relative min-h-screen overflow-x-clip font-sans`}>
      <script dangerouslySetInnerHTML={{ __html: landingThemeScript }} />
      <div aria-hidden="true" className="lp-progress-beam fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400" />

      {/* Backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[1200px] overflow-hidden">
        <div className="lp-grid absolute inset-0" />
        <div className="lp-orb lp-drift-a left-[-10%] top-[-12%] size-[620px] bg-teal-500/25" />
        <div className="lp-orb lp-drift-b right-[-12%] top-[8%] size-[560px] bg-indigo-600/25" />
        <div className="lp-orb lp-drift-a left-[35%] top-[45%] size-[420px] bg-cyan-500/10" />
      </div>
      <div aria-hidden="true" className="lp-noise pointer-events-none fixed inset-0 z-[1]" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-lp-line bg-lp-nav backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" aria-label="Converszio home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-lp-muted md:flex lg:gap-8">
            <a href="#reveal" className="py-3 transition hover:text-lp-fg">Hidden markup</a>
            <a href="#use-cases" className="py-3 transition hover:text-lp-fg">Use cases</a>
            <a href="#calculator" className="py-3 transition hover:text-lp-fg">Calculator</a>
            <a href="#faq" className="py-3 transition hover:text-lp-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Magnetic>
              <a
                href="#join"
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lp-fg px-3.5 py-2 text-sm font-semibold text-lp-bg transition hover:opacity-90 sm:px-4"
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
                className="lp-particle rounded-full border border-lp-line bg-lp-card px-2.5 py-1 text-xs font-semibold text-lp-accent"
                style={{ left: `${left}%`, ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ["--dx" as string]: `${dx}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-32">
            <div>
              <div className="lp-rise inline-flex flex-wrap items-center gap-2.5 rounded-full border border-lp-accent-line bg-lp-accent-soft py-1.5 pl-2 pr-4">
                <span className="relative flex size-2.5">
                  <span className="lp-pulse-ring absolute inset-0 rounded-full bg-teal-400" />
                  <span className="relative size-2.5 rounded-full bg-teal-400" />
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-lp-accent">Invite-only beta</span>
                <span className="hidden text-[0.75rem] text-lp-muted sm:inline">· Communication, reimagined</span>
              </div>

              <h1
                className="lp-rise font-landing mt-7 text-[clamp(2.4rem,5.2vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.05em] text-lp-fg"
                style={{ animationDelay: "100ms" }}
              >
                Stop paying a tax
                <br />
                on every
                <br />
                <ScrambleWords words={ROTATING} className="lp-gradient-text lp-shimmer inline-block min-h-[1.1em]" />
              </h1>

              <p className="lp-rise mt-7 max-w-xl text-lg leading-relaxed text-lp-muted sm:text-xl" style={{ animationDelay: "200ms" }}>
                Most WhatsApp tools quietly add a <b className="font-semibold text-lp-fg">12–26% markup</b> on Meta&apos;s price — then
                charge a monthly plan on top. Converszio adds <b className="font-semibold text-lp-fg">nothing</b>. Don&apos;t believe
                us? Scratch your invoice.
              </p>

              <div className="lp-rise mt-9 max-w-lg" style={{ animationDelay: "300ms" }}>
                <WaitlistForm source="hero" />
              </div>

              <div className="lp-rise mt-7" style={{ animationDelay: "380ms" }}>
                <Magnetic strength={0.2}>
                  <a href="#reveal" className="group inline-flex items-center gap-3 text-sm font-medium text-lp-text transition hover:text-lp-fg">
                    <span className="grid size-10 place-items-center rounded-full border border-lp-line-strong bg-lp-card transition group-hover:border-lp-accent-line group-hover:bg-lp-accent-soft">
                      <ArrowDown className="size-4 animate-bounce text-lp-accent" />
                    </span>
                    Reveal the line your WhatsApp invoice hides
                  </a>
                </Magnetic>
              </div>

              {/* Same message, three prices */}
              <div className="lp-rise mt-10 grid max-w-lg grid-cols-3 overflow-hidden rounded-2xl border border-lp-line bg-lp-card text-center" style={{ animationDelay: "460ms" }}>
                <PriceTag label="Meta's price" value={`₹${META_RATES_INR.marketing}`} />
                <PriceTag
                  label="Other tools"
                  value={`up to ₹${(META_RATES_INR.marketing * (1 + priciest)).toFixed(2)}`}
                  className="border-x border-lp-line text-rose-500"
                  strike
                />
                <PriceTag label="Converszio" value={`₹${META_RATES_INR.marketing}`} className="text-lp-accent" glow />
              </div>
              <p className="mt-2 text-xs text-lp-subtle">One marketing message in India, before GST.</p>

              <div className="lp-rise mt-8 flex flex-wrap items-center gap-2 text-xs text-lp-muted" style={{ animationDelay: "540ms" }}>
                <span className="mr-1 font-medium uppercase tracking-[0.14em] text-lp-subtle">Built on</span>
                {["Official WhatsApp Cloud API", "Meta Embedded Signup", "Shopify sync"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-lp-line bg-lp-card px-3 py-1.5">
                    <ShieldCheck className="size-3.5 text-lp-accent" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="lp-rise relative mx-auto hidden md:block" style={{ animationDelay: "250ms" }}>
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-teal-400/30 via-cyan-500/10 to-indigo-500/30 blur-3xl" />
              <div className="lp-tilt">
                <div className="lp-float">
                  <PhoneChat business={heroScript.business} script={heroScript.script} />
                </div>
              </div>
              <FloatingChip className="-left-52 top-16 hidden xl:flex" delay="0s" dot="bg-emerald-400">
                Cart recovered · <b className="text-lp-fg">₹2,249</b>
              </FloatingChip>
              <FloatingChip className="-right-24 top-[40%] hidden xl:flex" delay="1.2s" dot="bg-sky-400">
                ✓✓ Delivered &amp; read
              </FloatingChip>
              <FloatingChip className="-left-48 bottom-24 hidden xl:flex" delay="2.4s" dot="bg-teal-400">
                Meta price · <b className="text-lp-accent">₹0 markup</b>
              </FloatingChip>
            </div>

            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-56 overflow-hidden opacity-40">
              <div className="lp-floor absolute -inset-x-1/2 top-0 h-[200%]" />
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
                  <Sparkles className="size-3.5 text-lp-accent opacity-60" />
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Scratch reveal */}
        <section id="reveal" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-8 sm:py-32">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_auto]">
            <div className="max-w-xl">
              <Eyebrow>The line nobody shows you</Eyebrow>
              <SplitHeading
                text="Scratch your WhatsApp invoice."
                accent="Find the hidden tax."
                className="font-landing mt-4 text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
              />
              <Reveal delay={150}>
                <p className="mt-6 text-lg leading-relaxed text-lp-muted">
                  Your bill shows a plan and &ldquo;message charges&rdquo;. What it doesn&apos;t spell out: those charges are
                  Meta&apos;s price <em>plus</em> a cut for your tool. Go on — scratch the silver strip.
                </p>
                <ol className="mt-8 space-y-4">
                  {[
                    ["01", "Meta sets the price of every message."],
                    ["02", "Most tools resell it with a markup baked in."],
                    ["03", "Converszio lets Meta bill you directly — the markup line disappears."],
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
        </section>

        {/* Use cases */}
        <section id="use-cases" className="relative scroll-mt-20 border-t border-lp-line">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
            <div className="max-w-2xl">
              <Eyebrow>Real campaigns, real chats</Eyebrow>
              <SplitHeading
                text="Every conversation is a"
                accent="sale waiting to happen."
                className="font-landing mt-4 text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
              />
              <Reveal delay={150}>
                <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                  What Indian businesses already run on WhatsApp — tap one and watch it play out.
                </p>
              </Reveal>
            </div>
            <Reveal delay={120} className="mt-14">
              <UseCases />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-8 sm:pb-32">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <SplitHeading
              text="From sign-up to first campaign"
              accent="in one sitting."
              className="font-landing mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
            />
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 120}>
                <div className="h-full">
                  <SpotlightCard className="group h-full p-6">
                    <div className="flex items-center gap-3">
                      <span className="relative grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-300 to-cyan-400 text-slate-950 shadow-[0_8px_24px_-8px_rgba(45,212,191,0.7)] transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110">
                        <Icon className="size-5" />
                      </span>
                      <span className="font-lcd text-sm font-bold text-lp-subtle">0{i + 1}</span>
                    </div>
                    <p className="font-landing mt-5 text-xl font-semibold text-lp-fg">{t}</p>
                    <p className="mt-2 text-lp-muted">{d}</p>
                  </SpotlightCard>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="relative scroll-mt-20 border-y border-lp-line bg-lp-card">
          <div aria-hidden="true" className="lp-orb lp-drift-b left-[-8%] top-[20%] size-[480px] bg-teal-500/10" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
            <div className="max-w-2xl">
              <Eyebrow>Savings calculator</Eyebrow>
              <SplitHeading
                text="Punch in your messages."
                accent="Watch the markup vanish."
                className="font-landing mt-4 text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
              />
              <Reveal delay={150}>
                <p className="mt-5 text-lg leading-relaxed text-lp-muted">
                  Other tools charge a monthly plan <em>and</em> a markup on every message. With Converszio you pay Meta directly
                  — nothing on top.
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
        <section id="why" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-8 sm:py-32">
          <Eyebrow>Why Converszio</Eyebrow>
          <SplitHeading
            text="Built to end the"
            accent="WhatsApp tax."
            className="font-landing mt-4 max-w-2xl text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
          />

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            <Reveal className="md:col-span-2">
              <SpotlightCard className="h-full p-7 sm:p-9">
                <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-landing lp-gradient-text text-[6rem] font-bold leading-none tracking-[-0.06em] sm:text-[8rem]">0%</p>
                    <p className="font-landing mt-2 text-2xl font-semibold text-lp-fg">markup. Ever.</p>
                    <p className="mt-2 max-w-sm text-lp-muted">Meta bills your own card at Meta&apos;s price. We never add a paisa on top of a message.</p>
                  </div>
                  <div className="font-lcd w-full max-w-[260px] rounded-2xl border border-lp-line bg-lp-elev p-4 text-xs shadow-sm">
                    <p className="tracking-[0.2em] text-lp-subtle">PER MARKETING MESSAGE</p>
                    <div className="mt-3 space-y-2 text-lp-text">
                      <div className="flex justify-between"><span>Meta charges</span><span>₹0.8631</span></div>
                      <div className="flex justify-between"><span>Converszio adds</span><span className="text-lp-accent">₹0.0000</span></div>
                      <div className="flex justify-between border-t border-dashed border-lp-line-strong pt-2 font-bold text-lp-fg"><span>You pay</span><span>₹0.8631</span></div>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={100}>
              <SpotlightCard className="group h-full p-7 sm:p-9">
                <InfinityIcon className="size-14 text-lp-accent transition-transform duration-700 group-hover:rotate-180" strokeWidth={1.5} />
                <p className="font-landing mt-6 text-2xl font-semibold text-lp-fg">Unlimited seats</p>
                <p className="mt-2 text-lp-muted">Your whole team in one inbox. Grow headcount without growing the bill.</p>
              </SpotlightCard>
            </Reveal>

            <Reveal>
              <SpotlightCard className="group h-full p-7 sm:p-9">
                <CreditCard className="size-10 text-lp-accent transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" strokeWidth={1.5} />
                <p className="font-landing mt-6 text-2xl font-semibold text-lp-fg">Pay Meta directly</p>
                <p className="mt-2 text-lp-muted">No prepaid wallets, no locked balances. Your messages, your card, Meta&apos;s invoice.</p>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={100} className="md:col-span-2">
              <SpotlightCard className="h-full p-7 sm:p-9">
                <p className="font-landing text-2xl font-semibold text-lp-fg">Everything you need to sell on WhatsApp</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {FEATURES.map(({ icon: Icon, t, d }) => (
                    <div key={t} className="group rounded-2xl border border-lp-line bg-lp-elev p-4 transition hover:-translate-y-1 hover:border-lp-accent-line">
                      <Icon className="size-5 text-lp-accent transition-transform group-hover:scale-125" />
                      <p className="mt-3 font-semibold text-lp-fg">{t}</p>
                      <p className="mt-1 text-sm text-lp-muted">{d}</p>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 pb-24 sm:px-8 sm:pb-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <SplitHeading
              text="Sounds too good?"
              accent="Ask away."
              className="font-landing mt-4 text-[clamp(2.2rem,5vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.045em] text-lp-fg"
            />
            <Reveal delay={150}>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-lp-muted">
                Zero markup raises fair questions. Here are the straight answers.
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
              <div aria-hidden="true" className="lp-orb lp-drift-a left-[calc(50%-230px)] top-[-230px] size-[460px] bg-teal-400/30" />
              <div aria-hidden="true" className="lp-orb lp-drift-b bottom-[-30%] right-[-10%] size-[380px] bg-indigo-500/25" />
              <div className="relative">
                <Eyebrow>Early access</Eyebrow>
                <SplitHeading
                  text="The future of WhatsApp marketing is"
                  accent="markup‑free."
                  className="font-landing mx-auto mt-5 max-w-3xl text-[clamp(2.2rem,5.5vw,4.25rem)] font-bold leading-[1.04] tracking-[-0.05em] text-lp-fg"
                />
                <p className="mx-auto mt-5 max-w-md text-lp-muted">
                  We&apos;re letting a small group in first. Leave your email and we&apos;ll save you a seat.
                </p>
                <div className="mx-auto mt-10 max-w-lg text-left">
                  <WaitlistForm source="footer" cta="Save my seat" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-lp-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-lp-subtle sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo className="origin-left scale-90" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#faq" className="py-2.5 transition hover:text-lp-fg">FAQ</a>
            <Link href="/privacy" className="py-2.5 transition hover:text-lp-fg">Privacy</Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="py-2.5 transition hover:text-lp-fg">Contact</a>
            )}
            <Link href="/early-access" className="py-2.5 transition hover:text-lp-fg">Team access</Link>
          </nav>
          <p>© {new Date().getFullYear()} Converszio. WhatsApp is a trademark of Meta Platforms, Inc.</p>
        </div>
      </footer>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-lp-accent">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-current" />
      {children}
    </p>
  )
}

function PriceTag({ label, value, className, strike, glow }: { label: string; value: string; className?: string; strike?: boolean; glow?: boolean }) {
  return (
    <div className={`px-2 py-3.5 ${className ?? ""}`}>
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-lp-subtle">{label}</p>
      <p className={`font-lcd mt-1 text-sm font-bold sm:text-base ${strike ? "line-through decoration-2" : ""} ${glow ? "drop-shadow-[0_0_10px_rgba(45,212,191,0.6)]" : ""}`}>
        {value}
      </p>
    </div>
  )
}

function FloatingChip({ children, className, delay, dot }: { children: React.ReactNode; className?: string; delay: string; dot: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ animationDelay: delay }}
      className={`lp-chip absolute z-10 items-center gap-2 whitespace-nowrap rounded-full border border-lp-line bg-lp-elev px-3.5 py-2 text-xs text-lp-text shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] ${className ?? ""}`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
      {children}
    </div>
  )
}
