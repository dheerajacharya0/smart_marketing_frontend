"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Bluetooth,
  Check,
  ChevronDown,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SendHorizontal,
  Smartphone,
  Headphones,
  User,
  Volume2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WhatsappCall } from "@/services/api"
import type { CallRoute } from "@/lib/call-audio-route"
import {
  DECLINE_REPLIES,
  callerInitials,
  callerLabel,
  formatCallDuration,
  type CallLinkState,
} from "@/lib/calls"

/*
 * The call screen, modelled on WhatsApp's: full screen on a phone, a
 * phone-sized window over a dimmed dashboard on a desktop. Coloured from the
 * dashboard's theme tokens, so it follows the palette, brand colour and
 * light/dark mode like every other surface.
 *
 * One screen for the whole call — ringing, connecting, talking, ended — so
 * answering morphs the controls in place instead of swapping one overlay for
 * another (which let the page underneath flash through).
 *
 * Presentational only: `CallCenter` owns the call, the media and the socket.
 */

export type CallPhase = "incoming" | "connecting" | "active" | "ended"

export interface AudioOutput {
  deviceId: string
  label: string
  /** Set for Android call routes (earpiece, speaker, headsets). */
  kind?: CallRoute
}

const ROUTE_ICON: Record<CallRoute, typeof Volume2> = {
  earpiece: Smartphone,
  speaker: Volume2,
  wired: Headphones,
  usb: Headphones,
  bluetooth: Bluetooth,
}

function RouteIcon({ kind, className }: { kind: CallRoute; className?: string }) {
  const Icon = ROUTE_ICON[kind]
  return <Icon className={className} aria-hidden="true" />
}

export interface CallScreenProps {
  call: WhatsappCall
  phase: CallPhase
  /** Other calls queued behind this one. */
  waiting: number
  link: CallLinkState
  /** Seconds since the audio connected; null until it has. */
  elapsed: number | null
  /** What the ended screen says: "Call ended · 1:23", "Missed call", … */
  endedLabel: string
  muted: boolean
  remoteStream: MediaStream | null
  /** The browser refused to start the caller's audio without another tap. */
  audioBlocked: boolean
  outputs: AudioOutput[]
  outputId: string
  onAnswer: () => void
  onDecline: () => void
  onDeclineWithMessage: (message: string) => void
  onSelectOutput: (deviceId: string) => void
  onToggleMute: () => void
  onHangUp: () => void
  onMinimize: () => void
  onUnblockAudio: () => void
}

function statusText(link: CallLinkState, elapsed: number | null): string {
  if (link === "reconnecting") return "Reconnecting…"
  if (link === "failed") return "Call dropped"
  if (elapsed === null) return "Connecting…"
  return formatCallDuration(elapsed)
}

export function CallScreen(props: CallScreenProps) {
  const { call, phase, waiting, link, elapsed, muted, audioBlocked } = props
  const inCall = phase === "connecting" || phase === "active"
  const [replying, setReplying] = useState(false)
  const levelRef = useVoiceLevel(phase === "active" ? props.remoteStream : null)
  const acceptRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase === "incoming") acceptRef.current?.focus()
    else setReplying(false)
  }, [phase])

  const status =
    phase === "incoming" ? (
      <>
        Incoming voice call
        {waiting > 0 ? <span className="text-muted-foreground"> · {waiting} more waiting</span> : null}
      </>
    ) : phase === "connecting" ? (
      "Connecting…"
    ) : phase === "ended" ? (
      props.endedLabel
    ) : (
      <span className={cn("tabular-nums", link === "reconnecting" && "text-warning")}>
        {statusText(link, elapsed)}
      </span>
    )

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex justify-center sm:items-center sm:bg-background/70 sm:p-4 sm:backdrop-blur-md",
        phase === "ended"
          ? // Hold "Call ended" for a beat, then fade away.
            "fill-mode-forwards delay-1000 duration-500 animate-out fade-out-0"
          : "duration-300 animate-in fade-in-0",
      )}
    >
      <div
        role={phase === "incoming" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={
          phase === "incoming"
            ? `Incoming WhatsApp call from ${callerLabel(call)}`
            : `WhatsApp call with ${callerLabel(call)}`
        }
        className="call-surface relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground duration-300 ease-out animate-in slide-in-from-bottom-6 sm:h-[660px] sm:max-h-full sm:w-[380px] sm:rounded-[28px] sm:border sm:shadow-2xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        {/* Header */}
        <div className="relative flex h-14 items-center justify-center px-12 pt-[env(safe-area-inset-top)] text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {inCall ? (
            <button
              type="button"
              onClick={props.onMinimize}
              aria-label="Minimise the call"
              className="absolute left-2 rounded-full p-2.5 text-foreground/80 transition hover:bg-foreground/10 hover:text-foreground"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          ) : null}
          <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          WhatsApp voice call
        </div>

        {/* Caller */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <CallerAvatar call={call} ringing={phase === "incoming"} dimmed={phase === "ended"} levelRef={levelRef} />
          <div className="mt-6 max-w-full px-6 text-center">
            <h2 className="truncate font-display text-3xl font-semibold tracking-tight">{callerLabel(call)}</h2>
            {callerLabel(call) !== `+${call.customerWaId}` ? (
              <p className="mt-1 text-sm text-muted-foreground">+{call.customerWaId}</p>
            ) : null}
            <p
              key={phase}
              className="mt-3 text-base text-foreground/80 duration-300 animate-in fade-in-0"
              aria-live="polite"
            >
              {status}
            </p>
          </div>
          {inCall && muted ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground/80 duration-200 animate-in fade-in-0 zoom-in-95">
              <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> {"You're muted"}
            </p>
          ) : null}
          {phase === "active" && audioBlocked ? (
            <button
              type="button"
              onClick={props.onUnblockAudio}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" /> Tap to hear the caller
            </button>
          ) : null}
        </div>

        {/* Controls — keyed so the incoming row and the in-call tray cross-fade */}
        <div className="relative min-h-[152px] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          {phase === "incoming" ? (
            <div key="incoming" className="grid grid-cols-3 items-end px-4 duration-300 animate-in fade-in-0">
              <RoundAction label="Decline" tone="danger" onClick={props.onDecline}>
                <PhoneOff className="h-7 w-7" aria-hidden="true" />
              </RoundAction>
              <RoundAction label="Message" onClick={() => setReplying(true)}>
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </RoundAction>
              <div className="flex flex-col items-center gap-2">
                <button
                  ref={acceptRef}
                  type="button"
                  onClick={props.onAnswer}
                  aria-label="Accept"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_0_0_8px_hsl(var(--success)/0.15)] transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:animate-[call-nudge_1.6s_ease-in-out_infinite]"
                >
                  <Phone className="h-7 w-7" aria-hidden="true" />
                </button>
                <span className="text-xs text-muted-foreground">Accept</span>
              </div>
            </div>
          ) : inCall ? (
            <InCallTray key="call" {...props} />
          ) : null}
        </div>

        {replying && phase === "incoming" ? (
          <DeclineReplies
            onCancel={() => setReplying(false)}
            onSend={(message) => {
              setReplying(false)
              props.onDeclineWithMessage(message)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function InCallTray(props: CallScreenProps) {
  const { call, phase, muted, outputs, outputId } = props
  const [pickingOutput, setPickingOutput] = useState(false)
  const connecting = phase === "connecting"
  const current = outputs.find((o) => o.deviceId === outputId)
  const phonePair =
    outputs.length === 2 &&
    outputs.some((o) => o.kind === "earpiece") &&
    outputs.some((o) => o.kind === "speaker")
  const chatHref = call.conversationId ? `/dashboard/chat/${call.conversationId}` : "/dashboard/chat"

  return (
    <div className="relative duration-300 animate-in fade-in-0 slide-in-from-bottom-4">
      {pickingOutput ? (
        <div className="absolute inset-x-0 bottom-full mb-3 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl duration-200 animate-in fade-in-0 slide-in-from-bottom-2">
          <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Play audio on
          </p>
          <ul className="max-h-56 overflow-y-auto pb-1">
            {outputs.map((output) => (
              <li key={output.deviceId}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSelectOutput(output.deviceId)
                    setPickingOutput(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent"
                >
                  {output.kind ? <RouteIcon kind={output.kind} className="h-4 w-4 text-muted-foreground" /> : null}
                  <span className="min-w-0 flex-1 truncate">{output.label}</span>
                  {output.deviceId === outputId ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-sm items-start justify-around rounded-[28px] border bg-surface/80 px-2 pb-3 pt-4 shadow-sm backdrop-blur">
        {phonePair ? (
          // Just earpiece and loudspeaker: one tap flips between them, as on a phone.
          <RoundAction
            label="Speaker"
            tone={current?.kind === "speaker" ? "on" : "glass"}
            pressed={current?.kind === "speaker"}
            onClick={() => {
              const other = outputs.find((o) => o.deviceId !== outputId)
              if (other) props.onSelectOutput(other.deviceId)
            }}
            disabled={connecting}
            size="sm"
          >
            <Volume2 className="h-6 w-6" aria-hidden="true" />
          </RoundAction>
        ) : outputs.length > 1 ? (
          <RoundAction
            label={current?.kind && current.kind !== "speaker" ? current.label : "Speaker"}
            tone={pickingOutput || current?.kind === "speaker" ? "on" : "glass"}
            pressed={pickingOutput}
            onClick={() => setPickingOutput((v) => !v)}
            disabled={connecting}
            size="sm"
          >
            {current?.kind ? <RouteIcon kind={current.kind} className="h-6 w-6" /> : <Volume2 className="h-6 w-6" aria-hidden="true" />}
          </RoundAction>
        ) : null}
        <RoundAction
          label={muted ? "Unmute" : "Mute"}
          tone={muted ? "on" : "glass"}
          pressed={muted}
          onClick={props.onToggleMute}
          disabled={connecting}
          size="sm"
        >
          {muted ? <MicOff className="h-6 w-6" aria-hidden="true" /> : <Mic className="h-6 w-6" aria-hidden="true" />}
        </RoundAction>
        <div className="flex flex-col items-center gap-2">
          <Link
            href={chatHref}
            onClick={props.onMinimize}
            aria-label="Open the chat"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.07] transition hover:bg-foreground/15 active:scale-95"
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </Link>
          <span className="text-xs text-muted-foreground">Chat</span>
        </div>
        <RoundAction label="End" tone="danger" onClick={props.onHangUp} size="sm">
          <PhoneOff className="h-6 w-6" aria-hidden="true" />
        </RoundAction>
      </div>
    </div>
  )
}

/** Big round avatar: ripples while ringing, a voice-driven ring while talking. */
function CallerAvatar({
  call,
  ringing,
  dimmed,
  levelRef,
}: {
  call: WhatsappCall
  ringing: boolean
  dimmed: boolean
  levelRef: React.Ref<HTMLSpanElement>
}) {
  const initials = callerInitials(call)
  return (
    <div className={cn("relative flex h-40 w-40 items-center justify-center transition-opacity duration-500", dimmed && "opacity-50")}>
      {ringing ? (
        <>
          <span className="absolute inset-0 rounded-full bg-primary/20 motion-safe:animate-ping" aria-hidden="true" />
          <span
            className="absolute inset-4 rounded-full bg-primary/15 [animation-delay:600ms] motion-safe:animate-ping"
            aria-hidden="true"
          />
        </>
      ) : null}
      <span
        ref={levelRef}
        className="absolute inset-3 rounded-full bg-primary/25 opacity-0 transition-transform duration-100"
        aria-hidden="true"
      />
      <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 font-display text-4xl font-semibold text-primary-foreground shadow-[0_12px_40px_hsl(var(--primary)/0.35)] ring-4 ring-background">
        {initials || <User className="h-14 w-14 opacity-90" aria-hidden="true" />}
      </span>
    </div>
  )
}

function RoundAction({
  label,
  onClick,
  tone = "glass",
  size = "md",
  pressed,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  tone?: "glass" | "danger" | "on"
  size?: "sm" | "md"
  pressed?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          size === "md" ? "h-16 w-16" : "h-14 w-14",
          tone === "glass" && "bg-foreground/[0.07] hover:bg-foreground/15",
          tone === "on" && "bg-foreground text-background hover:bg-foreground/90",
          tone === "danger" && "bg-destructive text-destructive-foreground hover:brightness-110",
        )}
      >
        {children}
      </button>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function DeclineReplies({ onCancel, onSend }: { onCancel: () => void; onSend: (message: string) => void }) {
  const [custom, setCustom] = useState("")
  const trimmed = custom.trim()

  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-background/60 backdrop-blur-sm duration-200 animate-in fade-in-0" onClick={onCancel}>
      <div
        className="rounded-t-3xl border-t bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-2xl duration-300 animate-in slide-in-from-bottom-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-sm font-medium text-muted-foreground">Decline and send a message</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Back to the call"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul>
          {DECLINE_REPLIES.map((reply) => (
            <li key={reply}>
              <button
                type="button"
                onClick={() => onSend(reply)}
                className="w-full border-t px-5 py-3.5 text-left text-[15px] hover:bg-accent"
              >
                {reply}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-center gap-2 border-t px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onSend(trimmed)
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Write a message…"
            aria-label="Write your own message"
            maxLength={1000}
            className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!trimmed}
            aria-label="Send and decline"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * The "return to call" bar WhatsApp shows while you look at something else
 * mid-call.
 */
export function MinimizedCallBar({
  call,
  link,
  elapsed,
  muted,
  onExpand,
  onToggleMute,
  onHangUp,
}: {
  call: WhatsappCall
  link: CallLinkState
  elapsed: number | null
  muted: boolean
  onExpand: () => void
  onToggleMute: () => void
  onHangUp: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Call in progress"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] duration-300 animate-in fade-in-0 slide-in-from-top-4 sm:bottom-4 sm:top-auto sm:pt-0 sm:slide-in-from-bottom-4 sm:slide-in-from-top-0"
    >
      <div className="btn-primary flex w-full max-w-md items-center gap-2 rounded-full bg-primary py-1.5 pl-2 pr-1.5 text-primary-foreground shadow-lg">
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pl-1 text-left"
          aria-label="Return to the call"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
            <span className="absolute inset-0 rounded-full bg-primary-foreground/20 motion-safe:animate-ping" aria-hidden="true" />
            <Phone className="relative h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{callerLabel(call)}</span>
            <span className="block text-xs tabular-nums opacity-80">{statusText(link, elapsed)} · Tap to return</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            muted ? "bg-primary-foreground text-primary" : "hover:bg-primary-foreground/15",
          )}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onHangUp}
          aria-label="End the call"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:brightness-110"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Scales a ring behind the avatar with the caller's voice, the way WhatsApp's
 * avatar breathes while the other side talks. Writes the style directly each
 * frame instead of going through React state.
 */
function useVoiceLevel(stream: MediaStream | null) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!stream || !el || typeof window === "undefined" || !window.AudioContext) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

    let ctx: AudioContext
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    let smooth = 0
    let frame = 0

    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const v of samples) {
        const x = (v - 128) / 128
        sum += x * x
      }
      const rms = Math.sqrt(sum / samples.length)
      smooth = smooth * 0.8 + Math.min(1, rms * 4) * 0.2
      el.style.transform = `scale(${1 + smooth * 0.45})`
      el.style.opacity = String(0.3 + smooth * 0.7)
      frame = requestAnimationFrame(tick)
    }
    void ctx.resume().catch(() => undefined)
    tick()

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      void ctx.close().catch(() => undefined)
      el.style.transform = ""
      el.style.opacity = ""
    }
  }, [stream])

  return ref
}
