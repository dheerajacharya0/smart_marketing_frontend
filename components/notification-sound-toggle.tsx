"use client"

import { Volume2, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNotificationSoundToggle } from "@/hooks/use-notification-sound"
import { playNotificationTone } from "@/lib/notification-sound"

/**
 * Mute for the incoming-message tone.
 *
 * Sits in the top rail next to the theme control because that is where a
 * per-person, every-page preference belongs — burying it in Settings means the
 * first reaction to an unexpected sound is to leave the tab, not to find the
 * switch.
 *
 * Unmuting plays the tone once. A mute control that gives no feedback leaves
 * you unsure whether it worked, and this is also the click that lets the
 * browser start audio, so the next real message is not the one that silently
 * fails.
 */
export function NotificationSoundToggle() {
  const { muted, toggleMuted } = useNotificationSoundToggle()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted ? "Unmute new message sound" : "Mute new message sound"}
          aria-pressed={muted}
          className="h-9 w-9 rounded-md"
          onClick={() => {
            const wasMuted = muted
            toggleMuted()
            if (wasMuted) playNotificationTone()
          }}
        >
          {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {muted ? "New message sound is off" : "New message sound is on"}
      </TooltipContent>
    </Tooltip>
  )
}
