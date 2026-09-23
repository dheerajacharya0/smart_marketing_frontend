"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  appIsFocused,
  isEnabled as readEnabled,
  permissionState,
  previewOf,
  requestPermission,
  setEnabled as writeEnabled,
  shouldNotify,
  showMessageNotification,
  type PermissionState,
} from "@/lib/desktop-notification"

const ENABLED_CHANGED = "desktop-notifications-enabled-changed"

/** Shape the chat socket sends for a conversation row. */
interface SocketConversation {
  id?: string
  contactName?: string | null
  contactWaId?: string | null
  lastMessagePreview?: string | null
}

/**
 * Shared opt-in state for system notifications.
 *
 * Same window-event pattern as the sound preference, and the writes sit outside
 * the `setState` updater for the same reason: React calls updaters twice in
 * development to surface impure ones.
 */
function useEnabledPreference() {
  const [enabled, setEnabledState] = useState(false)
  const [permission, setPermission] = useState<PermissionState>("default")
  const enabledRef = useRef(false)
  const permissionRef = useRef<PermissionState>("default")

  const apply = useCallback((next: boolean) => {
    enabledRef.current = next
    setEnabledState(next)
  }, [])

  useEffect(() => {
    apply(readEnabled())
    const p = permissionState()
    permissionRef.current = p
    setPermission(p)
    const onChange = (e: Event) => apply((e as CustomEvent<boolean>).detail)
    window.addEventListener(ENABLED_CHANGED, onChange)
    return () => window.removeEventListener(ENABLED_CHANGED, onChange)
  }, [apply])

  /**
   * Turning it on asks the browser, from this click. Turning it off never
   * asks — and cannot un-deny, which is why the UI has to say so rather than
   * offer a switch that silently does nothing.
   */
  const toggle = useCallback(async () => {
    const next = !enabledRef.current
    if (next) {
      const p = await requestPermission()
      permissionRef.current = p
      setPermission(p)
      if (p !== "granted") {
        // Leave the switch off: an "on" switch that cannot notify is a lie.
        apply(false)
        writeEnabled(false)
        window.dispatchEvent(new CustomEvent(ENABLED_CHANGED, { detail: false }))
        return p
      }
    }
    apply(next)
    writeEnabled(next)
    window.dispatchEvent(new CustomEvent(ENABLED_CHANGED, { detail: next }))
    return permissionRef.current
  }, [apply])

  return { enabled, enabledRef, permission, permissionRef, toggle }
}

/**
 * Raises a system notification for an incoming message while the tab is in the
 * background. Mounted once, in the sidebar, beside the tone.
 */
export function useDesktopNotifications() {
  const { enabled, enabledRef, permission, permissionRef, toggle } = useEnabledPreference()

  const notifyFromSocketMessage = useCallback(
    (direction: string | undefined, conversation: SocketConversation | undefined) => {
      const decision = shouldNotify({
        enabled: enabledRef.current,
        // Read live, never from a ref captured at mount. The sidebar mounts on
        // sign-in and permission is granted later, from Settings — a cached
        // value is still "default" at that point, so every notification was
        // suppressed until a full reload. The browser owns this state; ask it.
        permission: permissionState(),
        appFocused: appIsFocused(),
        direction,
      })
      if (!decision) return
      const id = conversation?.id
      if (!id) return
      showMessageNotification({
        title: conversation?.contactName || conversation?.contactWaId || "New message",
        body: previewOf(conversation?.lastMessagePreview),
        tag: id,
        url: `/dashboard/chat/${id}`,
      })
    },
    [enabledRef],
  )

  return { enabled, permission, toggle, notifyFromSocketMessage }
}

/** Read/write view for the settings switch, which must not own the socket. */
export function useDesktopNotificationToggle() {
  const { enabled, permission, toggle } = useEnabledPreference()
  return { enabled, permission, toggle }
}
