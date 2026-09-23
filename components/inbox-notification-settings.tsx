"use client"

import { useEffect, useState } from "react"
import { BellRing, Volume2 } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { useNotificationSoundToggle } from "@/hooks/use-notification-sound"
import { useDesktopNotificationToggle } from "@/hooks/use-desktop-notifications"
import { playNotificationTone } from "@/lib/notification-sound"
import { isSupported } from "@/lib/desktop-notification"

/**
 * The two things that happen when a customer messages you.
 *
 * Both live here rather than only in the top rail because a preference you
 * might want to change once — and then forget where you set — belongs somewhere
 * you can go looking for it. The top-bar speaker stays, since silencing a sound
 * is urgent in a way that opening Settings is not.
 */
function Row({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: typeof Volume2
  title: string
  description: React.ReactNode
  control: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

export function InboxNotificationSettings() {
  const { muted, toggleMuted } = useNotificationSoundToggle()
  const { enabled, permission, toggle } = useDesktopNotificationToggle()

  // The Notification API is client-only, and the first render has to match the
  // server's.
  const [supported, setSupported] = useState(true)
  useEffect(() => setSupported(isSupported()), [])

  const denied = permission === "denied"

  return (
    <div className="space-y-5">
      <Row
        icon={Volume2}
        title="Play a sound"
        description="A short tone when a customer's message arrives. Bursts are collapsed to one tone."
        control={
          <Switch
            checked={!muted}
            aria-label="Play a sound for new messages"
            onCheckedChange={() => {
              const wasMuted = muted
              toggleMuted()
              // Turning it on proves it works, and is also the click that lets
              // the browser start audio.
              if (wasMuted) playNotificationTone()
            }}
          />
        }
      />

      <Row
        icon={BellRing}
        title="Show desktop notifications"
        description={
          !supported
            ? "This browser doesn't support desktop notifications."
            : denied
              ? // Script cannot un-deny; only the site settings can, so say
                // that instead of offering a switch that silently fails.
                "Blocked for this site. Allow notifications in your browser's site settings, then turn this on."
              : "Only while this tab is in the background — if you're looking at the inbox, the sound and the badge are enough."
        }
        control={
          <Switch
            checked={enabled}
            disabled={!supported || denied}
            aria-label="Show desktop notifications for new messages"
            onCheckedChange={() => {
              void toggle()
            }}
          />
        }
      />
    </div>
  )
}
