"use client"

import { useState } from "react"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/errors"
import { submitEmbeddedSignup, type EmbeddedSignupResult } from "@/services/api"
import { launchEmbeddedSignup, embeddedSignupReady } from "@/lib/facebook-sdk"

/**
 * Shared "Connect / Reconnect WhatsApp" action (Features 1 & 2). Runs Meta
 * Embedded Signup in a popup, hands the backend the `code`, and reports the
 * result. Disabled with a hint until ops provides the Meta config_id/app id.
 */
export function ConnectWhatsAppButton({
  label = "Connect WhatsApp",
  variant = "default",
  size = "default",
  className,
  onSuccess,
}: {
  label?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  onSuccess?: (result: EmbeddedSignupResult) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    if (!embeddedSignupReady) {
      toast.error("WhatsApp signup isn't configured yet — contact support.")
      return
    }
    setLoading(true)
    try {
      const code = await launchEmbeddedSignup()
      // Backend does token exchange + WABA discovery + register + subscribe; can
      // take a few seconds.
      const result = await submitEmbeddedSignup(code)
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

  return (
    <Button
      onClick={handleConnect}
      disabled={loading || !embeddedSignupReady}
      variant={variant}
      size={size}
      className={className}
      title={embeddedSignupReady ? undefined : "WhatsApp signup is not configured yet"}
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
