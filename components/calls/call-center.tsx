"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccountId } from "@/hooks/use-account-id"
import { useChatSocket } from "@/hooks/use-chat-socket"
import {
  answerCall,
  getRingingCalls,
  hangupCall,
  rejectCall,
  type WhatsappCall,
} from "@/services/api"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { applyCallUpdate, callerLabel, formatCallDuration } from "@/lib/calls"
import { answerOffer, closeCall, setMuted, type AnsweredCall } from "@/lib/call-webrtc"

interface ActiveCall {
  call: WhatsappCall
  media: AnsweredCall
  startedAt: number
}

/**
 * Incoming WhatsApp calls, on every dashboard page: a ringing card while a
 * customer is calling, and a call bar once this browser has answered.
 *
 * Every dashboard on the account rings together (the backend broadcasts each
 * call's state over the shared socket); the first to answer takes it and the
 * rest stop ringing on the update that follows. Audio runs directly between
 * this browser and Meta.
 */
export function CallCenter() {
  const { accountId } = useAccountId()
  const [ringing, setRinging] = useState<WhatsappCall[]>([])
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [active, setActive] = useState<ActiveCall | null>(null)
  const [muted, setMutedState] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const activeRef = useRef<ActiveCall | null>(null)
  activeRef.current = active
  const audioRef = useRef<HTMLAudioElement>(null)

  const endLocally = useCallback((message?: string) => {
    const current = activeRef.current
    if (current) closeCall(current.media)
    setActive(null)
    setMutedState(false)
    if (message) toast(message)
  }, [])

  const loadRinging = useCallback(() => {
    if (!accountId) return
    getRingingCalls(accountId)
      .then(setRinging)
      .catch(() => {
        // A dashboard that can't take calls (a scoped agent) gets a 403 here;
        // it simply never rings.
      })
  }, [accountId])

  useEffect(loadRinging, [loadRinging])

  useChatSocket(
    accountId,
    useCallback(
      (msg) => {
        if (msg.type !== "call") return
        setRinging((list) => applyCallUpdate(list, msg.call))
        // The customer hung up, or Meta ended it, while we were on the line.
        const current = activeRef.current
        if (
          current &&
          current.call.id === msg.call.id &&
          ["ended", "missed", "rejected", "failed"].includes(msg.call.status)
        ) {
          endLocally("Call ended")
        }
      },
      [endLocally],
    ),
    loadRinging,
  )

  // Tick the in-call timer.
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])

  // Release the microphone if the page is left mid-call.
  useEffect(() => () => {
    if (activeRef.current) closeCall(activeRef.current.media)
  }, [])

  const answer = async (call: WhatsappCall) => {
    if (!accountId || !call.sdpOffer || answeringId || activeRef.current) return
    setAnsweringId(call.id)
    let media: AnsweredCall | null = null
    try {
      media = await answerOffer(call.sdpOffer)
      const accepted = await answerCall(accountId, call.id, media.sdpAnswer)
      const started: ActiveCall = { call: accepted, media, startedAt: Date.now() }
      setActive(started)
      setRinging((list) => list.filter((c) => c.id !== call.id))
      media.remoteStream.then((stream) => {
        if (audioRef.current && activeRef.current?.call.id === call.id) {
          audioRef.current.srcObject = stream
          void audioRef.current.play().catch(() => undefined)
        }
      })
    } catch (err) {
      if (media) closeCall(media)
      if (getErrorStatus(err) === 409) {
        toast("A teammate answered this call")
        setRinging((list) => list.filter((c) => c.id !== call.id))
      } else if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.error("Allow microphone access in your browser to take calls")
      } else {
        toast.error(getErrorMessage(err, "Couldn't answer the call"))
      }
    } finally {
      setAnsweringId(null)
    }
  }

  const decline = async (call: WhatsappCall) => {
    if (!accountId) return
    setRinging((list) => list.filter((c) => c.id !== call.id))
    try {
      await rejectCall(accountId, call.id)
    } catch (err) {
      if (getErrorStatus(err) !== 409) {
        toast.error(getErrorMessage(err, "Couldn't decline the call"))
      }
    }
  }

  const hangUp = async () => {
    const current = activeRef.current
    if (!accountId || !current) return
    endLocally()
    try {
      await hangupCall(accountId, current.call.id)
    } catch (err) {
      if (getErrorStatus(err) !== 409) {
        toast.error(getErrorMessage(err, "Couldn't end the call cleanly"))
      }
    }
  }

  const toggleMute = () => {
    if (!active) return
    setMuted(active.media.localStream, !muted)
    setMutedState(!muted)
  }

  const incoming = active ? [] : ringing.slice(0, 1)

  return (
    <>
      <audio ref={audioRef} autoPlay className="hidden" />

      {incoming.map((call) => (
        <div
          key={call.id}
          role="alertdialog"
          aria-label={`Incoming WhatsApp call from ${callerLabel(call)}`}
          className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
              <PhoneIncoming className="h-5 w-5 animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{callerLabel(call)}</p>
              <p className="text-xs text-muted-foreground">
                Incoming WhatsApp call
                {ringing.length > 1 ? ` · ${ringing.length - 1} more waiting` : ""}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => decline(call)}
              disabled={answeringId === call.id}
            >
              <PhoneOff className="mr-1 h-4 w-4" /> Decline
            </Button>
            <Button
              className="flex-1 bg-success text-white hover:bg-success/90"
              onClick={() => answer(call)}
              disabled={Boolean(answeringId)}
            >
              <Phone className="mr-1 h-4 w-4" />
              {answeringId === call.id ? "Connecting…" : "Answer"}
            </Button>
          </div>
        </div>
      ))}

      {active ? (
        <div
          role="region"
          aria-label="Call in progress"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border bg-background px-5 py-2 shadow-lg"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden="true" />
          <span className="max-w-48 truncate text-sm font-medium">{callerLabel(active.call)}</span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatCallDuration((now - active.startedAt) / 1000)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="destructive" onClick={hangUp}>
            <PhoneOff className="mr-1 h-4 w-4" /> Hang up
          </Button>
        </div>
      ) : null}
    </>
  )
}
