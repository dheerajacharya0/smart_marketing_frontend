"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/errors"
import { submitEmbeddedSignup, type EmbeddedSignupResult } from "@/services/api"
import { launchEmbeddedSignup, embeddedSignupReady } from "@/lib/facebook-sdk"

/** Server-side Facebook OAuth + the 4-step wizard. No frontend Meta env vars. */
const OAUTH_ONBOARDING_HREF = "/dashboard/whatsapp/new"

/**
 * Shared "Connect / Reconnect WhatsApp" action (Features 1 & 2). Runs Meta
 * Embedded Signup in a popup, hands the backend the `code`, and reports the
 * result.
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
}) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const { code, wabaId, phoneNumberId } = await launchEmbeddedSignup()
      // Backend does token exchange + WABA discovery + register + subscribe; can
      // take a few seconds.
      const result = await submitEmbeddedSignup(code, { wabaId, phoneNumberId })
      if (result.registered) {
        toast.success("WhatsApp connected")
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
      // A cancelled popup rejects too — keep it quiet-ish but informative.
      toast.error(getErrorMessage(err, "Couldn't connect WhatsApp. Please try again."))
    } finally {
      setLoading(false)
    }
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
    <Button
      onClick={handleConnect}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="mr-2 h-4 w-4" />
      )}
      {loading ? "Connecting…" : label}
    </Button>
  )
}
