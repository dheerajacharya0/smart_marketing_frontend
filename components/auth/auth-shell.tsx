import type React from "react"
import Link from "next/link"
import { CheckCircle2, ShieldCheck, Zap, Users } from "lucide-react"

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none">
          <path
            d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M8.4 7.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.3 0 .6.3.5.8 1.1 1.4 1.6.8.6 1.4.8 1.7.9.2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.3 0 .3 0 .9-.3 1.3-.3.4-1.1.9-1.6.9-1.4 0-3.3-.9-4.6-2.2-1.4-1.4-2.3-3.2-2.3-4.6 0-.5.3-1.2.6-1.6.1-.1.2-.3.4-.4Z"
            fill="hsl(142 70% 45%)"
          />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-white">Converszio</span>
    </div>
  )
}

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Launch campaigns in minutes",
    body: "Reach thousands of opted-in customers on WhatsApp with approved templates and live delivery tracking.",
  },
  {
    icon: Users,
    title: "One shared team inbox",
    body: "Assign, label, and reply to every conversation in real time — no more juggling personal phones.",
  },
  {
    icon: ShieldCheck,
    title: "Compliant by default",
    body: "Automatic opt-out handling and number-quality monitoring keep your account healthy with Meta.",
  },
]

/**
 * Split-screen auth layout. Left = brand story panel (hidden below lg),
 * right = the form card. Shared by login, forgot/reset password, verify email.
 */
export default function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] max-w-[640px] overflow-hidden lg:flex lg:flex-col brand-gradient">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <BrandMark />

          <div className="space-y-10">
            <div className="space-y-4">
              <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                The WhatsApp platform serious businesses run on.
              </h2>
              <p className="max-w-md text-[15px] leading-relaxed text-white/75">
                Campaigns, a team inbox, automation, and analytics — everything you need to turn conversations into
                revenue, in one place.
              </p>
            </div>

            <ul className="space-y-5">
              {HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex gap-3.5">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur">
                    <h.icon className="h-[18px] w-[18px] text-white" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white">{h.title}</p>
                    <p className="max-w-sm text-[13px] leading-relaxed text-white/70">{h.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6 text-white/70">
            <div className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4" />
              <span>SOC 2 Type II</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Meta Business Partner</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4" />
              <span>99.9% uptime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="dashboard-container flex flex-1 flex-col">
        {/* Mobile brand bar */}
        <div className="flex items-center justify-between p-6 lg:hidden">
          <div className="brand-gradient inline-flex rounded-full px-3 py-1.5">
            <BrandMark />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
            </div>

            {children}

            <p className="mt-10 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
