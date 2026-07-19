"use client"

import { toast } from "react-hot-toast"
import {
  ApiError,
  getFacebookLoginUrl,
  isFacebookReconnectError,
  isOutside24hWindow,
} from "@/services/api"

// Guards against stacking a second reconnect toast while one is already up (an
// expired token typically fails several parallel requests at once).
let reconnectToastVisible = false

async function startFacebookReconnect(): Promise<void> {
  try {
    const url = await getFacebookLoginUrl()
    window.location.href = url
  } catch {
    toast.error("Couldn't start Facebook reconnect. Try again from Settings.")
  }
}

/**
 * Central reaction to a Meta/Graph error. Call it from any catch block that
 * wraps an API call touching WhatsApp:
 *
 *   catch (e) { if (handleFacebookError(e)) return; toast.error(...) }
 *
 * Returns true when it recognised and handled the error (so the caller should
 * stop), false otherwise (caller shows its own message).
 */
export function handleFacebookError(error: unknown): boolean {
  if (isFacebookReconnectError(error)) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Your Facebook connection needs attention."

    if (!reconnectToastVisible) {
      reconnectToastVisible = true
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <span>{message}</span>
            <div className="flex gap-2">
              <button
                className="rounded bg-black px-3 py-1 text-sm font-medium text-white"
                onClick={() => {
                  toast.dismiss(t.id)
                  void startFacebookReconnect()
                }}
              >
                Reconnect Facebook
              </button>
              <button
                className="rounded px-3 py-1 text-sm text-gray-500"
                onClick={() => toast.dismiss(t.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 10000, id: "facebook-reconnect" },
      )
      // Reset the guard once this toast's lifetime is over.
      setTimeout(() => {
        reconnectToastVisible = false
      }, 10000)
    }
    return true
  }

  if (isOutside24hWindow(error)) {
    toast.error(
      error instanceof ApiError
        ? error.message
        : "This contact is outside the 24-hour window. Send an approved template to reopen it.",
    )
    return true
  }

  return false
}
