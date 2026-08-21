"use client"

import type { ReactNode } from "react"
import { MousePointerClick } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tick, tickStateOf, statusLabelOf } from "@/components/status-pill"
import { MediaBubble } from "@/components/chat/media-bubble"
import { InteractiveBubble } from "@/components/chat/interactive-bubble"
import type { ConversationMessage } from "@/hooks/use-chat-messages"
import { cn } from "@/lib/utils"

/**
 * One message in the thread.
 *
 * Grouping is the point of the `isFirstOfGroup` / `isLastOfGroup` flags: a run
 * of messages from the same sender inside a few minutes reads as one block —
 * only the first shows an avatar, only the last gets the bubble tail and the
 * timestamp. A thread where every line repeats the same avatar and clock is
 * noisier to read and says nothing extra.
 */

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

interface MessageBubbleProps {
  message: ConversationMessage
  /** Fallback initials for the inbound avatar. */
  contactName: string
  accountId: string
  isFirstOfGroup: boolean
  isLastOfGroup: boolean
  /** Resolves template placeholders — the raw row only carries the parameters. */
  renderContent: (message: ConversationMessage) => ReactNode
}

export function MessageBubble({
  message,
  contactName,
  accountId,
  isFirstOfGroup,
  isLastOfGroup,
  renderContent,
}: MessageBubbleProps) {
  const isOut = message.sender === "me"
  const isPending = message.id.startsWith("pending-")

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOut ? "justify-end" : "justify-start",
        // Tight inside a group, roomier between groups.
        isFirstOfGroup ? "mt-3" : "mt-0.5",
      )}
    >
      {!isOut &&
        (isLastOfGroup ? (
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-whatsapp/10 text-[10px] text-whatsapp">
              {contactName.slice(-2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          // Keeps the run flush with the avatar above it.
          <span aria-hidden className="h-7 w-7 shrink-0" />
        ))}

      <div
        className={cn(
          "chat-bubble signal-fade",
          isOut ? "chat-bubble-out" : "chat-bubble-in",
          isLastOfGroup && "chat-bubble-tail",
          isPending && "chat-bubble-pending",
        )}
      >
        {message.media ? (
          <MediaBubble media={message.media} accountId={accountId} />
        ) : message.interactive ? (
          <InteractiveBubble interactive={message.interactive} />
        ) : (
          <>
            {message.isMenuReply && (
              <p className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MousePointerClick className="h-3 w-3" /> replied to menu
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {renderContent(message)}
            </p>
          </>
        )}

        {/* Time and delivery state on every bubble. Both are per-message —
            three messages sent together can end up sent, delivered and
            failed — so grouping must not collapse them. */}
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{formatTime(message.timestamp)}</span>
          {isOut && <DeliveryState message={message} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Delivery state as a tick, not as a raw enum. `accepted` is the honest one —
 * WhatsApp has queued the message and nothing more; only a webhook upgrades it
 * to delivered or read, and it can still fail long afterwards.
 */
function DeliveryState({ message }: { message: ConversationMessage }) {
  // No status yet means the request hasn't come back — a clock, not a tick.
  // One tick is a claim that WhatsApp has the message, and until the send
  // resolves that isn't known.
  const state = tickStateOf(message.status ?? "pending")

  if (state === "failed") {
    const detail =
      message.errorTitle || message.errorCode
        ? `Failed${message.errorCode ? ` (${message.errorCode})` : ""}: ${
            message.errorTitle ?? "Delivery failed"
          }`
        : "Delivery failed"
    return (
      <span className="inline-flex cursor-help items-center gap-1 font-medium text-destructive" title={detail}>
        <Tick state="failed" />
        Failed
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center"
      title={
        state === "sent"
          ? "Sent — WhatsApp has it, not delivered yet"
          : state === "delivered"
            ? "Delivered to their phone"
            : state === "read"
              ? "Read"
              : statusLabelOf(message.status ?? "pending")
      }
    >
      <span className="sr-only">{statusLabelOf(message.status ?? "")}</span>
      <Tick state={state} />
    </span>
  )
}

/**
 * Date divider. Sticks to the top of the thread while its day scrolls past, so
 * "when was this" stays answerable without scrolling back up.
 */
export function DaySeparator({ date }: { date: Date }) {
  return (
    <div className="sticky top-0 z-10 flex justify-center py-2">
      <span className="chat-day-chip rounded-full px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
        {formatDay(date)}
      </span>
    </div>
  )
}

function formatDay(date: Date) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(date, today)) return "Today"
  if (sameDay(date, yesterday)) return "Yesterday"

  // Within the last week, the weekday alone is the most readable label.
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
  if (daysAgo < 7) return date.toLocaleDateString(undefined, { weekday: "long" })

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  })
}

/**
 * Splits a thread into day sections, and each section into runs by sender.
 * Done here rather than in the page so the grouping rule lives next to the
 * component that renders it.
 */
export interface MessageGroup {
  date: Date
  runs: ConversationMessage[][]
}

/** Messages this far apart start a new run even from the same sender. */
const RUN_GAP_MS = 5 * 60_000

export function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []

  for (const message of messages) {
    const last = groups[groups.length - 1]
    const sameDay = last && last.date.toDateString() === message.timestamp.toDateString()

    if (!sameDay) {
      groups.push({ date: message.timestamp, runs: [[message]] })
      continue
    }

    const lastRun = last.runs[last.runs.length - 1]
    const previous = lastRun[lastRun.length - 1]
    const continues =
      previous.sender === message.sender &&
      message.timestamp.getTime() - previous.timestamp.getTime() < RUN_GAP_MS

    if (continues) lastRun.push(message)
    else last.runs.push([message])
  }

  return groups
}
