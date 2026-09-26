"use client"

import { useCallback, useEffect, useState } from "react"
import {
  disablePush,
  enablePush,
  isSubscribed,
  pushSupport,
  PushNotConfiguredError,
  resyncPush,
  type PushSupport,
} from "@/lib/web-push"
import { getVapidPublicKey } from "@/services/api"

export type PushStatus =
  | "checking"
  | PushSupport
  /** Browser can do it; the server has no VAPID keys yet. */
  | "not-configured"
  | "denied"
  | "ready"

/** State and toggle for the "notify this device" switch in Settings. */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("checking")
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const support = pushSupport()
      if (support !== "supported") {
        if (!cancelled) setStatus(support)
        return
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied")
        return
      }
      const [key, sub] = await Promise.all([
        getVapidPublicKey().catch(() => null),
        isSubscribed().catch(() => false),
      ])
      if (cancelled) return
      setSubscribed(sub)
      setStatus(key ? "ready" : "not-configured")
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) {
        await disablePush()
        setSubscribed(false)
        return
      }
      const permission = await enablePush()
      if (permission === "granted") setSubscribed(true)
      else if (permission === "denied") setStatus("denied")
    } catch (err) {
      if (err instanceof PushNotConfiguredError) setStatus("not-configured")
      else setError("Couldn't turn on notifications for this device. Try again.")
    } finally {
      setBusy(false)
    }
  }, [subscribed])

  return { status, subscribed, busy, error, toggle }
}

/**
 * Once per app load, re-send this device's subscription (if any) so the
 * backend has the current endpoint and the current user. Mounted beside the
 * socket in the sidebar.
 */
export function usePushResync() {
  useEffect(() => {
    void resyncPush()
  }, [])
}
