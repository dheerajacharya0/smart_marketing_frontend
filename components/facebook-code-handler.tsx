"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { handleFacebookCallback, ApiError } from "@/services/api"
import { consumeOAuthState } from "@/lib/oauth-state"

interface FacebookCodeHandlerProps {
  onConnectionSuccess?: () => void;
}

export default function FacebookCodeHandler({ onConnectionSuccess }: FacebookCodeHandlerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // OAuth codes are single-use — track which one we've already sent so re-renders
  // (e.g. onConnectionSuccess getting a new identity) don't resend the same code.
  const handledCodeRef = useRef<string | null>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code || handledCodeRef.current === code) return
    handledCodeRef.current = code

    const sendCode = async () => {
      try {
        // Verify the CSRF nonce BEFORE spending the code. The backend doesn't
        // check `state`, so a code arriving without the nonce this tab issued is
        // someone else's — exchanging it would bind their Facebook account here.
        if (!consumeOAuthState(searchParams.get("state"))) {
          toast.error("That Facebook link didn't come from this app — start again from Settings.")
          return
        }
        await handleFacebookCallback(code)
        onConnectionSuccess?.()
      } catch (error) {
        console.error("Failed to handle Facebook callback:", error)
        const status = error instanceof ApiError ? error.status : undefined
        if (status === 401 || status === 404) {
          // No/expired JWT, or the backend couldn't find the user for a valid-looking
          // token — either way the app's auth state is broken, so send them to log in again.
          toast.error("Please log in again to connect Facebook")
          window.location.href = "/login"
        } else if (status === 400) {
          toast.error(error instanceof Error ? error.message : "This Facebook account is already linked to another user")
        } else {
          toast.error(error instanceof Error ? error.message : "Failed to connect Facebook account")
        }
      } finally {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("code")
        params.delete("state")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
      }
    }
    sendCode()
  }, [searchParams, onConnectionSuccess, router, pathname])

  return null
}
