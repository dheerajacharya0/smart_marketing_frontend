"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MessageCircle, Smartphone, SmartphoneNfc } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getErrorMessage } from "@/lib/errors"
import { isNumberInUseCancel } from "@/lib/embedded-signup-session"
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

type DialogView = "choose" | "number-in-use"

/**
 * Shared "Connect / Reconnect WhatsApp" action (Features 1 & 2). Runs Meta
 * Embedded Signup in a popup, hands the backend the `code`, and reports the
 * result.
 *
 * Before the popup it asks whether the number is new or already on the
 * WhatsApp Business app: Meta refuses a number that is still on an app unless
 * the signup runs in coexistence mode, and that refusal ("already registered to
 * a WhatsApp account") was the dead end people hit. If they pick "new" anyway
 * and Meta refuses, the same dialog explains it and offers coexistence.
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
  const [loading, setLoading] = useState(false)
  const [dialogView, setDialogView] = useState<DialogView | null>(null)

  const connect = async (mode: EmbeddedSignupMode) => {
    setDialogView(null)
    setLoading(true)
    try {
      const { code, wabaId, phoneNumberId } = await launchEmbeddedSignup(mode)
      // Backend does token exchange + WABA discovery + register + subscribe; can
      // take a few seconds.
      // `mode` only when it matters: a backend without the field rejects any
      // body that carries it, and plain signups must keep working against one.
      const result = await submitEmbeddedSignup(code, {
        wabaId,
        phoneNumberId,
        mode: mode === "coexistence" ? mode : undefined,
      })
      if (result.registered) {
        toast.success("WhatsApp connected")
        if (result.syncError) {
          // Meta allows 24 hours to import the app's chats and contacts; after
          // that the number has to be connected again to get them.
          toast(`Connected, but importing your WhatsApp Business app chats didn't start: ${result.syncError}. Retry it from the WhatsApp page within 24 hours.`, {
            icon: "⚠️",
            duration: 10000,
          })
        }
      } else {
        // Linked but not registered — still usable; surface as a soft warning.
        toast(
          result.registerError
            ? `Number linked but not yet registered: ${result.registerError}`
            : "Number linked but not yet registered — retry or contact support.",
          { icon: "⚠️", duration: 8000 }
        )
      }
      onSuccess?.(result)
    } catch (err) {
      if (err instanceof EmbeddedSignupCancelledError) {
        if (mode === "new" && isNumberInUseCancel(err.cancel)) {
          setDialogView("number-in-use")
        } else if (err.cancel?.errorMessage) {
          toast.error(`Meta stopped the sign-up: ${err.cancel.errorMessage}`, { duration: 8000 })
        } else {
          toast("WhatsApp sign-up was closed before it finished.")
        }
        return
      }
      toast.error(getErrorMessage(err, "Couldn't connect WhatsApp. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  const handleClick = () => {
    if (!askNumberType) {
      void connect("new")
      return
    }
    // Warm the SDK while they read the choices, so FB.login runs inside the
    // click that picks one and the browser doesn't block the popup.
    loadFacebookSdk().catch(() => {})
    setDialogView("choose")
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
      <Button onClick={handleClick} disabled={loading} variant={variant} size={size} className={className}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
        {loading ? "Connecting…" : label}
      </Button>

      <Dialog open={dialogView !== null} onOpenChange={(open) => !open && setDialogView(null)}>
        <DialogContent className="sm:max-w-md">
          {dialogView === "number-in-use" ? (
            <>
              <DialogHeader>
                <DialogTitle>This number is still on a WhatsApp app</DialogTitle>
                <DialogDescription>
                  Meta only accepts it as a new number once it is off every WhatsApp app. You have two ways
                  forward.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="font-medium">Keep using the WhatsApp Business app</p>
                  <p className="mt-1 text-muted-foreground">
                    Connect it as it is and scan a QR code in the app. Your chats stay on the phone. If the number
                    is on personal WhatsApp, switch it to the WhatsApp Business app first — your chats move with
                    it.
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">Use the number only here</p>
                  <p className="mt-1 text-muted-foreground">
                    On the phone, open WhatsApp → Settings → Account → Delete my account. Wait about 3 minutes,
                    then connect it as a new number. This deletes that WhatsApp account and its chats.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDialogView(null)}>
                  Close
                </Button>
                <Button onClick={() => void connect("coexistence")}>Connect WhatsApp Business app</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Which number are you connecting?</DialogTitle>
                <DialogDescription>Meta handles the two differently, so pick the one that fits.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <NumberTypeOption
                  icon={<SmartphoneNfc className="h-5 w-5" />}
                  title="Already on the WhatsApp Business app"
                  description="Keep using the app on your phone alongside this tool. You'll scan a QR code in the app."
                  onSelect={() => void connect("coexistence")}
                />
                <NumberTypeOption
                  icon={<Smartphone className="h-5 w-5" />}
                  title="New number, not on WhatsApp"
                  description="Works only through this tool. Numbers on personal WhatsApp or the Business app are refused here."
                  onSelect={() => void connect("new")}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function NumberTypeOption({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
