"use client"

import { useEffect, useRef } from "react"
import { supportsCallActions } from "@/hooks/use-call-media-session"

/**
 * Screen Wake Lock fallback for Safari and Firefox — browsers without
 * Chromium's call-shaped Media Session actions (see use-call-media-session).
 *
 * Research on this: Apple's own developer forums and the WebKit bug tracker
 * confirm there is no workaround for iOS Safari — WebRTC and Web Audio are
 * suspended the moment the screen locks or Safari backgrounds, full stop
 * ("Safari Should Allow Background WebRTC for Real-Time Audio Apps" is a
 * still-open Apple forum thread, not a solved problem). The only lever a
 * web page gets on iOS is stopping the screen from auto-locking in the
 * first place: Screen Wake Lock, supported in Safari from iOS 16.4 in an
 * ordinary tab (installed home-screen apps were broken until iOS 18.4, and
 * some reports say it's still inconsistent there — test on the actual
 * device). Firefox is in better shape: Wake Lock shipped in 126 on desktop
 * and 149 on Android, both current as of this writing, with no known
 * background-audio suspension bug to work around.
 *
 * Caveat worth being upfront about: a Wake Lock only stops the *automatic*
 * timeout from locking the screen. If the person manually presses the power
 * button mid-call, it locks anyway and audio dies the same way — no web API
 * can override that, on any browser. That gap only closes with a native app
 * holding a real OS-level call integration (CallKit / ConnectionService).
 */
export function useCallWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !("wakeLock" in navigator) || supportsCallActions()) return
    let cancelled = false

    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) {
            void sentinel.release()
            return
          }
          sentinelRef.current = sentinel
        })
        .catch(() => {
          // Denied (low battery, no user gesture yet, …) — the call still runs.
        })
    }

    acquire()
    // The lock is released the moment the page is hidden (that's the one
    // case it was never going to cover) — re-acquire once it's visible
    // again in case the call is still going.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) acquire()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      void sentinelRef.current?.release()
      sentinelRef.current = null
    }
  }, [active])
}
