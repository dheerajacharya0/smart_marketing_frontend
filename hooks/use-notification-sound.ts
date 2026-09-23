"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  isMuted as readMuted,
  playNotificationTone,
  setMuted as writeMuted,
  shouldPlay,
  unlockAudioOnFirstGesture,
} from "@/lib/notification-sound"

const MUTE_CHANGED = "notification-sound-muted-changed"

/**
 * Shared mute state for the incoming-message tone.
 *
 * Mirrored through a window event rather than React context: the toggle lives
 * in the top bar and the socket listener lives in the sidebar, different
 * subtrees, and a context spanning both would re-render the whole dashboard
 * shell to flip one boolean.
 *
 * The writes deliberately sit *outside* the `setState` updater. They were
 * inside it first, which is an impure updater — React invokes those twice in
 * development to surface exactly this, so every toggle wrote the preference
 * twice and left the stored value disagreeing with what the button showed.
 */
function useMutePreference() {
  // `false` on the server and on first paint: localStorage is client-only and
  // reading it during render would mismatch hydration.
  const [muted, setMutedState] = useState(false)
  // Mirrors state so the toggle can read the current value without taking it
  // as a dependency and being rebuilt on every change.
  const mutedRef = useRef(false)

  const apply = useCallback((next: boolean) => {
    mutedRef.current = next
    setMutedState(next)
  }, [])

  useEffect(() => {
    apply(readMuted())
    const onChange = (e: Event) => apply((e as CustomEvent<boolean>).detail)
    window.addEventListener(MUTE_CHANGED, onChange)
    return () => window.removeEventListener(MUTE_CHANGED, onChange)
  }, [apply])

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current
    apply(next)
    writeMuted(next)
    // Tells the other subtree; this instance has already applied it.
    window.dispatchEvent(new CustomEvent(MUTE_CHANGED, { detail: next }))
  }, [apply])

  return { muted, mutedRef, toggleMuted }
}

/**
 * Plays a tone when a customer's message arrives.
 *
 * Mounted once, in the sidebar, because the sidebar is on every dashboard route
 * and already holds the one shared chat socket — the tone has to follow you
 * around the product, not only sound while the inbox is open.
 */
export function useNotificationSound() {
  const { muted, mutedRef, toggleMuted } = useMutePreference()
  const lastPlayedAt = useRef<number | null>(null)

  useEffect(() => unlockAudioOnFirstGesture(), [])

  /**
   * Call on every socket frame. Outbound events are filtered here rather than
   * at the call site so there is one place that decides what counts as "someone
   * messaged you" — a message you sent from another device echoes back on this
   * socket too, and dinging for your own reply is the bug people notice first.
   */
  const notifyFromSocketEvent = useCallback(
    (direction: string | undefined) => {
      if (direction !== "inbound") return
      const now = Date.now()
      if (!shouldPlay({ muted: mutedRef.current, now, lastPlayedAt: lastPlayedAt.current })) return
      lastPlayedAt.current = now
      playNotificationTone()
    },
    [mutedRef],
  )

  return { muted, toggleMuted, notifyFromSocketEvent }
}

/** Read/write view for the toggle, which must not own the socket. */
export function useNotificationSoundToggle() {
  const { muted, toggleMuted } = useMutePreference()
  return { muted, toggleMuted }
}
