"use client"

import { useEffect } from "react"

/**
 * Chrome ships lock-screen/notification call actions ("hangup",
 * "togglemicrophone") beyond what TypeScript's bundled DOM lib knows about
 * yet — they work at runtime, the string union here is just wider than
 * `lib.dom.d.ts`'s `MediaSessionAction`.
 */
type CallAction = MediaSessionAction | "hangup" | "togglemicrophone"

/**
 * Whether this browser accepts the call-shaped actions at all — Chromium
 * only (Chrome/Edge). Safari and Firefox throw on an unrecognized action
 * name, which is how we tell them apart without sniffing the UA string.
 * `use-call-wake-lock.ts` falls back to the Wake Lock API when this is
 * false, since that's the only lever left on those browsers.
 */
export function supportsCallActions(): boolean {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return false
  try {
    navigator.mediaSession.setActionHandler("hangup" as MediaSessionAction, () => {})
    navigator.mediaSession.setActionHandler("hangup" as MediaSessionAction, null)
    return true
  } catch {
    return false
  }
}

interface CallMediaSessionOptions {
  active: boolean
  title: string
  onHangUp: () => void
  onToggleMute: () => void
}

/**
 * Declares this tab as an ongoing call to the OS, the same Media Session
 * integration Meet/Discord's web clients use.
 *
 * Without it, a locked screen is where the call dies: Android treats a
 * backgrounded tab with no declared media session as just another
 * suspendable page and freezes its JS (and with it the mic capture and
 * WebRTC pipeline) on the OS's own schedule — `connectionState` still reads
 * "connected" because the peer connection itself isn't touched, but no audio
 * moves either way. A `playbackState: "playing"` media session is what
 * Android's power management recognizes as active media and exempts from
 * that freeze — it's the mechanism background music/podcast PWAs rely on to
 * keep playing with the screen off, and Chrome extends it to call-shaped
 * actions (hang up, mute) for WebRTC calling apps specifically. It also
 * surfaces hang-up/mute on the lock screen and notification shade, same as
 * a native call.
 *
 * This is a Chromium feature; Safari and Firefox don't expose the call
 * actions, so there the call still runs exactly as before — just without the
 * extra protection or lock-screen controls. `use-call-wake-lock.ts` covers
 * those two with the only lever they do expose. No web page can force a
 * true guarantee here (that's what native apps use CallKit/
 * ConnectionService foreground services for), this is the closest the
 * platform gives a regular tab.
 */
export function useCallMediaSession({ active, title, onHangUp, onToggleMute }: CallMediaSessionOptions): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("mediaSession" in navigator)) return
    const session = navigator.mediaSession

    const setHandler = (action: CallAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action as MediaSessionAction, handler)
      } catch {
        // This browser doesn't know this action (e.g. "hangup" outside Chromium).
      }
    }

    session.metadata = new MediaMetadata({ title, artist: "WhatsApp call" })
    session.playbackState = "playing"
    setHandler("hangup", onHangUp)
    setHandler("togglemicrophone", onToggleMute)

    return () => {
      setHandler("hangup", null)
      setHandler("togglemicrophone", null)
      session.playbackState = "none"
      session.metadata = null
    }
  }, [active, title, onHangUp, onToggleMute])
}
