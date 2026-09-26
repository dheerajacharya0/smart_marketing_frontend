"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import {
  Check,
  ChevronDown,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SendHorizontal,
  User,
  Volume2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WhatsappCall } from "@/services/api"
import {
  DECLINE_REPLIES,
  callerInitials,
  callerLabel,
  formatCallDuration,
  type CallLinkState,
} from "@/lib/calls"

/*
 * The call screens, modelled on WhatsApp's own: a full-screen dark surface on
 * a phone, a phone-sized window over a dimmed dashboard on a desktop. Always
 * dark, whatever the dashboard theme — a call should look like a call.
 *
 * Presentational only: `CallCenter` owns the call, the media and the socket.
 */

const SURFACE_STYLE: CSSProperties = {
  background: "radial-gradient(120% 75% at 50% 0%, #1f4f42 0%, #102c26 45%, #0b141a 100%)",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
}

function CallSurface({
  label,
  role,
  children,
}: {
  label: string
  role: "alertdialog" | "dialog"
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-center sm:items-center sm:bg-black/60 sm:p-4 sm:backdrop-blur-sm">
      <div
        role={role}
        aria-modal="true"
        aria-label={label}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden text-white sm:h-[660px] sm:max-h-full sm:w-[380px] sm:rounded-[28px] sm:shadow-2xl sm:ring-1 sm:ring-white/10"
        style={SURFACE_STYLE}
      >
        {children}
      </div>
    </div>
  )
}

function CallHeading({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-14 items-center justify-center px-4 text-xs font-medium uppercase tracking-[0.14em] text-white/60">
      <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      WhatsApp voice call
      {children}
    </div>
  )
}

/** Big round avatar. `ringing` adds the outward ripples of an incoming call. */
function CallerAvatar({
  call,
  ringing,
  levelRef,
}: {
  call: WhatsappCall
  ringing?: boolean
  /** A ring driven by the caller's voice, scaled from outside without re-rendering. */
  levelRef?: React.Ref<HTMLSpanElement>
}) {
  const initials = callerInitials(call)
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {ringing ? (
        <>
          <span className="absolute inset-0 rounded-full bg-[#25d366]/20 motion-safe:animate-ping" aria-hidden="true" />
          <span
            className="absolute inset-4 rounded-full bg-[#25d366]/15 motion-safe:animate-ping [animation-delay:600ms]"
            aria-hidden="true"
          />
        </>
      ) : null}
      {levelRef ? (
        <span
          ref={levelRef}
          className="absolute inset-3 rounded-full bg-[#25d366]/25 transition-transform duration-100"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#2a6b5a] to-[#174338] text-4xl font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.45)] ring-2 ring-white/10">
        {initials || <User className="h-14 w-14 text-white/80" aria-hidden="true" />}
      </span>
    </div>
  )
}

function CallerIdentity({ call, status }: { call: WhatsappCall; status: ReactNode }) {
  const label = callerLabel(call)
  const showNumber = label !== `+${call.customerWaId}`
  return (
    <div className="mt-6 max-w-full px-6 text-center">
      <h2 className="truncate text-3xl font-semibold tracking-tight">{label}</h2>
      {showNumber ? <p className="mt-1 text-sm text-white/60">+{call.customerWaId}</p> : null}
      <p className="mt-3 text-base text-white/80" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

function RoundAction({
  label,
  onClick,
  tone = "glass",
  pressed,
  disabled,
  className,
  children,
}: {
  label: string
  onClick?: () => void
  tone?: "glass" | "danger" | "accept" | "on"
  pressed?: boolean
  disabled?: boolean
  className?: string
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
          "flex h-16 w-16 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b141a]",
          tone === "glass" && "bg-white/10 hover:bg-white/20",
          tone === "on" && "bg-white text-[#0b141a] hover:bg-white/90",
          tone === "danger" && "bg-[#f15c6d] hover:bg-[#e04558]",
          tone === "accept" && "bg-[#25d366] text-[#0b141a] hover:bg-[#1fbe5b]",
          className,
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/75">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Incoming
// ---------------------------------------------------------------------------

export function IncomingCallScreen({
  call,
  waiting,
  answering,
  onAnswer,
  onDecline,
  onDeclineWithMessage,
}: {
  call: WhatsappCall
  /** Other calls queued behind this one. */
  waiting: number
  answering: boolean
  onAnswer: () => void
  onDecline: () => void
  onDeclineWithMessage: (message: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const acceptRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    acceptRef.current?.focus()
  }, [call.id])

  return (
    <CallSurface role="alertdialog" label={`Incoming WhatsApp call from ${callerLabel(call)}`}>
      <CallHeading />

      <div className="flex flex-1 flex-col items-center justify-center">
        <CallerAvatar call={call} ringing={!answering} />
        <CallerIdentity
          call={call}
          status={
            answering ? (
              "Connecting…"
            ) : (
              <>
                Incoming voice call
                {waiting > 0 ? <span className="text-white/55"> · {waiting} more waiting</span> : null}
              </>
            )
          }
        />
      </div>

      <div className="grid grid-cols-3 items-end px-8 pb-10 pt-4">
        <RoundAction label="Decline" tone="danger" onClick={onDecline} disabled={answering}>
          <PhoneOff className="h-7 w-7" aria-hidden="true" />
        </RoundAction>
        <RoundAction label="Message" onClick={() => setReplying(true)} disabled={answering}>
          <MessageSquareText className="h-6 w-6" aria-hidden="true" />
        </RoundAction>
        <div className="flex flex-col items-center gap-2">
          <button
            ref={acceptRef}
            type="button"
            onClick={onAnswer}
            disabled={answering}
            aria-label="Accept"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25d366] text-[#0b141a] shadow-[0_0_0_8px_rgba(37,211,102,0.15)] transition hover:bg-[#1fbe5b] active:scale-95 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b141a] motion-safe:animate-[call-nudge_1.6s_ease-in-out_infinite] disabled:animate-none"
          >
            <Phone className="h-7 w-7" aria-hidden="true" />
          </button>
          <span className="text-xs text-white/75">{answering ? "Connecting…" : "Accept"}</span>
        </div>
      </div>

      {replying ? (
        <DeclineReplies
          onCancel={() => setReplying(false)}
          onSend={(message) => {
            setReplying(false)
            onDeclineWithMessage(message)
          }}
        />
      ) : null}
    </CallSurface>
  )
}

function DeclineReplies({ onCancel, onSend }: { onCancel: () => void; onSend: (message: string) => void }) {
  const [custom, setCustom] = useState("")
  const trimmed = custom.trim()

  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-black/50" onClick={onCancel}>
      <div
        className="rounded-t-3xl bg-[#1f2c34] pb-[env(safe-area-inset-bottom)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-sm font-medium text-white/70">Decline and send a message</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Back to the call"
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
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
                className="w-full border-t border-white/5 px-5 py-3.5 text-left text-[15px] hover:bg-white/5"
              >
                {reply}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-center gap-2 border-t border-white/5 px-4 py-3"
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
            className="h-11 flex-1 rounded-full bg-[#2a3942] px-4 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#25d366]/60"
          />
          <button
            type="submit"
            disabled={!trimmed}
            aria-label="Send and decline"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-[#0b141a] disabled:opacity-40"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// In a call
// ---------------------------------------------------------------------------

export interface AudioOutput {
  deviceId: string
  label: string
}

export interface ActiveCallProps {
  call: WhatsappCall
  link: CallLinkState
  /** Seconds since the audio connected; null until it has. */
  elapsed: number | null
  muted: boolean
  remoteStream: MediaStream | null
  /** The browser refused to start the caller's audio without another tap. */
  audioBlocked: boolean
  outputs: AudioOutput[]
  outputId: string
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

export function ActiveCallScreen(props: ActiveCallProps) {
  const { call, link, elapsed, muted, remoteStream, audioBlocked, outputs, outputId } = props
  const levelRef = useVoiceLevel(remoteStream)
  const [pickingOutput, setPickingOutput] = useState(false)
  const chatHref = call.conversationId ? `/dashboard/chat/${call.conversationId}` : "/dashboard/chat"

  return (
    <CallSurface role="dialog" label={`WhatsApp call with ${callerLabel(call)}`}>
      <div className="relative">
        <CallHeading />
        <button
          type="button"
          onClick={props.onMinimize}
          aria-label="Minimise the call"
          className="absolute left-2 top-2 rounded-full p-2.5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <CallerAvatar call={call} levelRef={levelRef} />
        <CallerIdentity
          call={call}
          status={
            <span className={cn("tabular-nums", link === "reconnecting" && "text-amber-300")}>
              {statusText(link, elapsed)}
            </span>
          }
        />
        {muted ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> {"You're muted"}
          </p>
        ) : null}
        {audioBlocked ? (
          <button
            type="button"
            onClick={props.onUnblockAudio}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0b141a]"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" /> Tap to hear the caller
          </button>
        ) : null}
      </div>

      <div className="relative px-4 pb-8">
        {pickingOutput ? (
          <div className="absolute inset-x-4 bottom-full mb-3 overflow-hidden rounded-2xl bg-[#1f2c34] shadow-2xl ring-1 ring-white/10">
            <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-white/50">Play audio on</p>
            <ul className="max-h-56 overflow-y-auto pb-1">
              {outputs.map((output) => (
                <li key={output.deviceId}>
                  <button
                    type="button"
                    onClick={() => {
                      props.onSelectOutput(output.deviceId)
                      setPickingOutput(false)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5"
                  >
                    <span className="min-w-0 flex-1 truncate">{output.label}</span>
                    {output.deviceId === outputId ? <Check className="h-4 w-4 text-[#25d366]" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mx-auto flex max-w-sm items-start justify-around rounded-[28px] bg-black/25 px-2 pb-3 pt-4 ring-1 ring-white/5 backdrop-blur">
          {outputs.length > 1 ? (
            <RoundAction
              label="Speaker"
              tone={pickingOutput ? "on" : "glass"}
              pressed={pickingOutput}
              onClick={() => setPickingOutput((v) => !v)}
              className="h-14 w-14"
            >
              <Volume2 className="h-6 w-6" aria-hidden="true" />
            </RoundAction>
          ) : null}
          <RoundAction
            label={muted ? "Unmute" : "Mute"}
            tone={muted ? "on" : "glass"}
            pressed={muted}
            onClick={props.onToggleMute}
            className="h-14 w-14"
          >
            {muted ? <MicOff className="h-6 w-6" aria-hidden="true" /> : <Mic className="h-6 w-6" aria-hidden="true" />}
          </RoundAction>
          <div className="flex flex-col items-center gap-2">
            <Link
              href={chatHref}
              onClick={props.onMinimize}
              aria-label="Open the chat"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
            >
              <MessageCircle className="h-6 w-6" aria-hidden="true" />
            </Link>
            <span className="text-xs text-white/75">Chat</span>
          </div>
          <RoundAction label="End" tone="danger" onClick={props.onHangUp} className="h-14 w-14">
            <PhoneOff className="h-6 w-6" aria-hidden="true" />
          </RoundAction>
        </div>
      </div>
    </CallSurface>
  )
}

/**
 * The green "return to call" bar WhatsApp shows while you look at something
 * else mid-call.
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
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:bottom-4 sm:top-auto sm:pt-0"
    >
      <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-[#0f6b4d] py-1.5 pl-2 pr-1.5 text-white shadow-lg ring-1 ring-black/10">
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pl-1 text-left"
          aria-label="Return to the call"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Phone className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{callerLabel(call)}</span>
            <span className="block text-xs tabular-nums text-white/75">
              {statusText(link, elapsed)} · Tap to return
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            muted ? "bg-white text-[#0f6b4d]" : "hover:bg-white/15",
          )}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onHangUp}
          aria-label="End the call"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f15c6d] hover:bg-[#e04558]"
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
      el.style.opacity = String(0.25 + smooth * 0.75)
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
