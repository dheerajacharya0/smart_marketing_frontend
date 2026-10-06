"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Facebook,
  History,
  ListChecks,
  Loader2,
  Lock,
  MessageCircle,
  Smartphone,
  SmartphoneNfc,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"
import { isNumberInUseCancel } from "@/lib/embedded-signup-session"
import { ONBOARDING_STEPS } from "@/components/whatsapp-integration-stepper"
import { submitEmbeddedSignup, type EmbeddedSignupResult } from "@/services/api"
import {
  EmbeddedSignupCancelledError,
  embeddedSignupReady,
  launchEmbeddedSignup,
  loadFacebookSdk,
  type EmbeddedSignupMode,
} from "@/lib/facebook-sdk"

/** Server-side Facebook OAuth + the 4-step wizard. No frontend Meta env vars. */
const OAUTH_ONBOARDING_HREF = "/dashboard/whatsapp/new"

type View =
  | { name: "choose"; notice?: string }
  | { name: "waiting"; mode: EmbeddedSignupMode }
  | { name: "finishing"; mode: EmbeddedSignupMode }
  | { name: "success"; mode: EmbeddedSignupMode; result: EmbeddedSignupResult }
  | { name: "number-in-use" }
  | { name: "error"; mode: EmbeddedSignupMode; message: string }

/**
 * The one way into WhatsApp onboarding (Features 1 & 2). Opens a guided dialog
 * that stays with the user through the whole connection: pick the kind of
 * number, continue with Facebook, wait while Meta's window is open, then a
 * result — instead of a bare popup followed by a toast.
 *
 * Two kinds of number, because Meta handles them differently: a new number is
 * registered for the API only, while one already on the WhatsApp Business app
 * goes through Meta's coexistence flow and keeps working in the app. Meta
 * refuses an app number in the plain flow ("already registered to a WhatsApp
 * account"); that refusal lands on its own screen offering the app route.
 *
 * Embedded Signup needs two build-time Meta values. When they are missing this
 * used to render a permanently disabled button — on the setup checklist that was
 * step 1's only affordance, so a new account hit a dead end with nothing to
 * explain it. A second, entirely independent onboarding path exists and needs no
 * frontend Meta credentials (the backend serves the OAuth URL), so fall back to
 * that rather than to a disabled control.
 */
export function ConnectWhatsAppButton({
  label = "Connect WhatsApp",
  variant = "default",
  size = "default",
  className,
  onSuccess,
  unconfiguredFallback = "link",
  askNumberType = true,
}: {
  label?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  onSuccess?: (result: EmbeddedSignupResult) => void
  /**
   * What to render when Embedded Signup isn't configured. "link" sends the user
   * down the OAuth path instead; "hide" is for places that already offer their
   * own route there, where the fallback would only duplicate it.
   */
  unconfiguredFallback?: "link" | "hide"
  /**
   * Ask "new number or WhatsApp Business app?" before the popup. Off for
   * reconnects, which re-pick a number already in the WABA.
   */
  askNumberType?: boolean
}) {
  const [view, setView] = useState<View | null>(null)
  const [choice, setChoice] = useState<Choice>("new")
  // Bumped by every launch and every close: a popup the user walked away from
  // can still resolve later, and must not drag a closed or restarted dialog
  // into a stale result.
  const attempt = useRef(0)

  const busy = view?.name === "waiting" || view?.name === "finishing"

  const connect = async (chosen: EmbeddedSignupMode) => {
    const id = ++attempt.current
    const current = () => attempt.current === id
    setView({ name: "waiting", mode: chosen })
    try {
      const { code, wabaId, phoneNumberId } = await launchEmbeddedSignup(chosen)
      if (!current()) return
      setView({ name: "finishing", mode: chosen })
      // Backend does token exchange + WABA discovery + register + subscribe; can
      // take a few seconds. `mode` only when it matters: a backend without the
      // field rejects any body that carries it.
      const result = await submitEmbeddedSignup(code, {
        wabaId,
        phoneNumberId,
        mode: chosen === "coexistence" ? chosen : undefined,
      })
      if (!current()) return
      setView({ name: "success", mode: chosen, result })
      onSuccess?.(result)
    } catch (err) {
      if (!current()) return
      if (err instanceof EmbeddedSignupCancelledError) {
        if (chosen === "new" && isNumberInUseCancel(err.cancel)) {
          setView({ name: "number-in-use" })
        } else if (err.cancel?.errorMessage) {
          setView({ name: "error", mode: chosen, message: err.cancel.errorMessage })
        } else if (askNumberType) {
          setView({ name: "choose", notice: "The Facebook window was closed before setup finished." })
        } else {
          setView(null)
        }
        return
      }
      setView({
        name: "error",
        mode: chosen,
        message: getErrorMessage(err, "Couldn't connect WhatsApp. Please try again."),
      })
    }
  }

  const open = () => {
    // Warm the SDK while they read the choices, so FB.login runs inside the
    // click that continues and the browser doesn't block the popup.
    loadFacebookSdk().catch(() => {})
    if (askNumberType) setView({ name: "choose" })
    else void connect("new")
  }

  const close = () => {
    attempt.current++
    setView(null)
  }

  if (!embeddedSignupReady) {
    if (unconfiguredFallback === "hide") return null
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={OAUTH_ONBOARDING_HREF}>
          <MessageCircle className="mr-2 h-4 w-4" />
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button onClick={open} disabled={busy} variant={variant} size={size} className={className}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
        {busy ? "Connecting…" : label}
      </Button>

      <Dialog open={view !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="gap-0 p-0 sm:max-w-xl">
          {view?.name === "choose" && (
            <ChooseView
              choice={choice}
              onChoiceChange={setChoice}
              notice={view.notice}
              onContinue={(mode) => void connect(mode)}
              onLeave={close}
            />
          )}
          {view?.name === "waiting" && <WaitingView mode={view.mode} onCancel={close} />}
          {view?.name === "finishing" && <FinishingView mode={view.mode} />}
          {view?.name === "success" && <SuccessView mode={view.mode} result={view.result} onDone={close} />}
          {view?.name === "number-in-use" && (
            <NumberInUseView
              onUseApp={() => {
                setChoice("coexistence")
                void connect("coexistence")
              }}
              onBack={() => setView({ name: "choose" })}
            />
          )}
          {view?.name === "error" && (
            <ErrorView
              message={view.message}
              onRetry={() => void connect(view.mode)}
              onBack={askNumberType ? () => setView({ name: "choose" }) : close}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// --- Views -----------------------------------------------------------------

/**
 * The three ways in. The first two run Meta's popup (Embedded Signup); the
 * third is the step-by-step wizard — how people get through when pop-ups are
 * blocked, when they manage several businesses, or when they'd rather see
 * each step. It sits among the choices rather than in small print because it
 * is a real route, not a fallback nobody finds.
 */
type Choice = EmbeddedSignupMode | "guided"

const CHOICES: Array<{
  choice: Choice
  icon: typeof Smartphone
  title: string
  description: string
  tag?: string
}> = [
  {
    choice: "new",
    icon: Smartphone,
    title: "A new number",
    description: "Not on WhatsApp yet. You'll verify it with a code, and it works only from this dashboard.",
  },
  {
    choice: "coexistence",
    icon: SmartphoneNfc,
    title: "My WhatsApp Business app number",
    description: "Keep chatting from your phone. Your contacts and recent chats come across too.",
    tag: "Keep using the app",
  },
  {
    choice: "guided",
    icon: ListChecks,
    title: "Step-by-step setup",
    description:
      "Link Facebook, pick your business, then add and verify your number — one page at a time. Handy if pop-ups are blocked or you manage several businesses.",
  },
]

const REQUIREMENTS: Record<Choice, string[]> = {
  new: [
    "A Facebook account to sign in with",
    "Your business name and website",
    "A phone number not on any WhatsApp app, able to receive an SMS or call",
  ],
  coexistence: [
    "A Facebook account to sign in with",
    "Your business name and website",
    "Your phone with the WhatsApp Business app (version 2.24.17 or newer) to scan a QR code",
  ],
  guided: [
    "A Facebook account with access to your business",
    "Your business name and website",
    "A phone number not on any WhatsApp app, able to receive an SMS or call",
  ],
}

/** The wizard's own stepper, so the preview and the pages agree. */
const GUIDED_STEPS = [...ONBOARDING_STEPS]
const POPUP_STEPS = ["Sign in with Facebook", "Choose your business", "Confirm your number"]

function ChooseView({
  choice,
  onChoiceChange,
  notice,
  onContinue,
  onLeave,
}: {
  choice: Choice
  onChoiceChange: (choice: Choice) => void
  notice?: string
  onContinue: (mode: EmbeddedSignupMode) => void
  /** Closes the dialog as the guided setup takes over the page. */
  onLeave: () => void
}) {
  const guided = choice === "guided"
  return (
    <>
      <div className="space-y-5 p-6 pb-5">
        <ViewHeader
          icon={<MessageCircle className="h-5 w-5" />}
          title="Connect your WhatsApp number"
          description="About 3 minutes. You'll sign in with Facebook to link your business — we take care of the rest."
        />

        {notice ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </p>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-medium">How would you like to connect?</legend>
          <div role="radiogroup" className="grid gap-3">
            {CHOICES.map((option) => (
              <ChoiceCard
                key={option.choice}
                {...option}
                selected={choice === option.choice}
                onSelect={() => onChoiceChange(option.choice)}
              />
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg bg-muted/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What you&apos;ll need</p>
          <ul className="mt-2.5 space-y-2">
            {REQUIREMENTS[choice].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <StepStrip steps={guided ? GUIDED_STEPS : POPUP_STEPS} active={0} />
      </div>

      <ViewFooter>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Secure sign-in through Meta. We never see your Facebook password.
        </p>
        {guided ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href={OAUTH_ONBOARDING_HREF} onClick={onLeave}>
              Start guided setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button
            // `secondary`, not the default: the default variant paints the
            // theme gradient over any background, and this is Meta's button.
            variant="secondary"
            onClick={() => onContinue(choice)}
            className="w-full bg-facebook text-white shadow-xs hover:bg-facebook/90 hover:shadow-sm sm:w-auto"
          >
            <Facebook className="mr-2 h-4 w-4" />
            Continue with Facebook
          </Button>
        )}
      </ViewFooter>
    </>
  )
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  tag,
  selected,
  onSelect,
}: {
  icon: typeof Smartphone
  title: string
  description: string
  tag?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-base ease-out-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary-soft/60 shadow-sm ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {tag ? (
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">{tag}</span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  )
}

/** The steps ahead, with the current one highlighted; step 0 is before anything opens. */
function StepStrip({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2 sm:flex-1">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              i < active
                ? "bg-success text-success-foreground"
                : i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {i < active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn("text-xs", i === active ? "font-medium text-foreground" : "text-muted-foreground")}>
            {step}
          </span>
          {i < steps.length - 1 ? <span aria-hidden className="mx-2 hidden h-px flex-1 bg-border sm:block" /> : null}
        </li>
      ))}
    </ol>
  )
}

function WaitingView({ mode, onCancel }: { mode: EmbeddedSignupMode; onCancel: () => void }) {
  return (
    <>
      <StatusBlock
        icon={<Facebook className="h-6 w-6" />}
        tone="facebook"
        spinning
        title="Finish in the Facebook window"
        description={
          mode === "coexistence"
            ? "Sign in, pick your business, then scan the QR code with the WhatsApp Business app on your phone."
            : "Sign in, pick your business, then add and verify your number. Keep this page open."
        }
      >
        <p className="text-xs text-muted-foreground">
          Don&apos;t see it? Your browser may have blocked the pop-up — allow pop-ups for this site and try again.
        </p>
      </StatusBlock>
      <ViewFooter>
        <span />
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </ViewFooter>
    </>
  )
}

function FinishingView({ mode }: { mode: EmbeddedSignupMode }) {
  return (
    <StatusBlock
      icon={<Loader2 className="h-6 w-6 animate-spin" />}
      tone="primary"
      title="Setting up your number"
      description={
        mode === "coexistence"
          ? "Linking your business and starting the import from the WhatsApp Business app. This takes a few seconds."
          : "Linking your business and registering your number. This takes a few seconds."
      }
    />
  )
}

function SuccessView({
  mode,
  result,
  onDone,
}: {
  mode: EmbeddedSignupMode
  result: EmbeddedSignupResult
  onDone: () => void
}) {
  const warning = !result.registered
    ? `Your number is linked but not registered yet${result.registerError ? `: ${result.registerError}` : ""}. Try connecting it again, or contact support.`
    : result.syncError
      ? `Importing your chats from the app didn't start (${result.syncError}). Retry it from the WhatsApp page within 24 hours.`
      : null
  return (
    <>
      <StatusBlock
        icon={warning ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
        tone={warning ? "warning" : "success"}
        title={warning ? "Connected, with one thing to finish" : "WhatsApp is connected"}
        description={
          mode === "coexistence"
            ? "Messages from this dashboard and the WhatsApp Business app now share one number."
            : "Your number is ready to send and receive messages."
        }
      >
        {warning ? (
          <p className="rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-left text-sm text-warning">
            {warning}
          </p>
        ) : mode === "coexistence" ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-left text-sm text-muted-foreground">
            <History className="mt-0.5 h-4 w-4 shrink-0" />
            Your contacts and recent chats are being imported. They&apos;ll appear in the inbox over the next few
            minutes.
          </p>
        ) : null}
      </StatusBlock>
      <ViewFooter>
        <span className="hidden sm:block" />
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onDone} className="w-full sm:w-auto">
            Done
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/chat" onClick={onDone}>
              Open inbox
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </ViewFooter>
    </>
  )
}

function NumberInUseView({ onUseApp, onBack }: { onUseApp: () => void; onBack: () => void }) {
  return (
    <>
      <div className="space-y-5 p-6 pb-5">
        <ViewHeader
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
          title="This number is already on WhatsApp"
          description="Meta only accepts it as a new number once it's off every WhatsApp app. Choose how you'd like to continue."
        />
        <div className="grid gap-3">
          <div className="rounded-xl border border-primary bg-primary-soft/60 p-4 ring-1 ring-primary">
            <div className="flex flex-wrap items-center gap-2">
              <SmartphoneNfc className="h-4 w-4 text-primary" />
              <p className="font-medium">Connect it through the WhatsApp Business app</p>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                Recommended
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Keep using the app and your chats. You&apos;ll scan a QR code in the app. On personal WhatsApp? Switch
              the number to the WhatsApp Business app first — your chats move with it.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Use the number only here</p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              On the phone, open WhatsApp → Settings → Account → Delete my account. Wait about 3 minutes, then connect
              it as a new number. This permanently deletes that WhatsApp account and its chats.
            </p>
          </div>
        </div>
      </div>
      <ViewFooter>
        <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={onUseApp} className="w-full sm:w-auto">
          Connect WhatsApp Business app
        </Button>
      </ViewFooter>
    </>
  )
}

function ErrorView({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <>
      <StatusBlock
        icon={<AlertTriangle className="h-6 w-6" />}
        tone="destructive"
        title="We couldn't connect your number"
        description={message}
      />
      <ViewFooter>
        <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={onRetry} className="w-full sm:w-auto">
          Try again
        </Button>
      </ViewFooter>
    </>
  )
}

// --- Building blocks -------------------------------------------------------

type Tone = "primary" | "success" | "warning" | "destructive" | "facebook"

const TONE: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
  facebook: "bg-facebook/10 text-facebook",
}

function ViewHeader({
  icon,
  title,
  description,
  tone = "primary",
}: {
  icon: React.ReactNode
  title: string
  description: string
  tone?: Tone
}) {
  return (
    <div className="flex items-start gap-4 pr-6">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE[tone])}>{icon}</span>
      <div className="min-w-0 space-y-1">
        <DialogTitle className="text-lg font-semibold leading-tight tracking-tight">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
      </div>
    </div>
  )
}

/** Centred icon + message, for the in-flight and result screens. */
function StatusBlock({
  icon,
  tone,
  title,
  description,
  spinning,
  children,
}: {
  icon: React.ReactNode
  tone: Tone
  title: string
  description: string
  spinning?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-10 text-center">
      <span className="relative flex h-16 w-16 items-center justify-center">
        {spinning ? (
          <span aria-hidden className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-facebook" />
        ) : null}
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", TONE[tone])}>{icon}</span>
      </span>
      <div className="max-w-sm space-y-1.5">
        <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
      </div>
      {children ? <div className="w-full max-w-sm space-y-3">{children}</div> : null}
      {spinning ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Usually takes 2–3 minutes
        </p>
      ) : null}
    </div>
  )
}

function ViewFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  )
}
