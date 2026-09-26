"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { useAccountId } from "@/hooks/use-account-id"
import { useChatSocket } from "@/hooks/use-chat-socket"
import {
  answerCall,
  getRingingCalls,
  hangupCall,
  rejectCall,
  sendWhatsappMessage,
  type WhatsappCall,
} from "@/services/api"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { applyCallUpdate, callerLabel, linkStateOf, type CallLinkState } from "@/lib/calls"
import { answerOffer, closeCall, setMuted, type AnsweredCall } from "@/lib/call-webrtc"
import { startRingtone } from "@/lib/ringtone"
import {
  ActiveCallScreen,
  IncomingCallScreen,
  MinimizedCallBar,
  type AudioOutput,
} from "@/components/calls/call-screen"

interface ActiveCall {
  call: WhatsappCall
  media: AnsweredCall
}

type SinkableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }

/**
 * Incoming WhatsApp calls, on every dashboard page: a full ringing screen
 * while a customer is calling, and a call screen (minimisable to a bar) once
 * this browser has answered.
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
  const [link, setLink] = useState<CallLinkState>("connecting")
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [outputs, setOutputs] = useState<AudioOutput[]>([])
  const [outputId, setOutputId] = useState("default")
  const [now, setNow] = useState(() => Date.now())
  // Read by socket handlers and promise callbacks that outlive a render, so it
  // is written the moment a call starts or ends — not on the next render.
  const activeRef = useRef<ActiveCall | null>(null)
  const audioRef = useRef<SinkableAudio>(null)

  const endLocally = useCallback((message?: string) => {
    const current = activeRef.current
    if (current) closeCall(current.media)
    activeRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
    setActive(null)
    setMutedState(false)
    setLink("connecting")
    setConnectedAt(null)
    setRemoteStream(null)
    setAudioBlocked(false)
    setMinimized(false)
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

  const incoming = active ? null : (ringing[0] ?? null)

  // Ring — sound, vibration and a flashing tab title — while a call waits.
  const ringingNow = Boolean(incoming) && !answeringId
  useEffect(() => {
    if (!ringingNow) return
    const stopRingtone = startRingtone()
    const title = document.title
    let flip = false
    const flash = setInterval(() => {
      flip = !flip
      document.title = flip ? "Incoming call…" : title
    }, 1000)
    return () => {
      stopRingtone()
      clearInterval(flash)
      document.title = title
    }
  }, [ringingNow])

  // Play the caller's audio as soon as it arrives. The <audio> element is
  // always mounted, so this can't miss it.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.srcObject = remoteStream
    if (!remoteStream) return
    el.play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true))
  }, [remoteStream])

  // Tick the in-call timer.
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])

  // Speakers and headsets the caller's audio can play on (desktop browsers;
  // phones route audio themselves and don't support choosing).
  useEffect(() => {
    const el = audioRef.current
    if (!active || !el || typeof el.setSinkId !== "function" || !navigator.mediaDevices?.enumerateDevices) {
      return
    }
    const refresh = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) =>
          setOutputs(
            devices
              .filter((d) => d.kind === "audiooutput" && d.deviceId)
              .map((d, i) => ({
                deviceId: d.deviceId,
                label: d.label || (d.deviceId === "default" ? "System default" : `Speaker ${i + 1}`),
              })),
          ),
        )
        .catch(() => setOutputs([]))
    }
    refresh()
    navigator.mediaDevices.addEventListener?.("devicechange", refresh)
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", refresh)
  }, [active])

  // Release the microphone if the page is left mid-call.
  useEffect(
    () => () => {
      if (activeRef.current) closeCall(activeRef.current.media)
    },
    [],
  )

  const hangUp = useCallback(
    async (message?: string) => {
      const current = activeRef.current
      if (!accountId || !current) return
      endLocally(message)
      try {
        await hangupCall(accountId, current.call.id)
      } catch (err) {
        if (getErrorStatus(err) !== 409) {
          toast.error(getErrorMessage(err, "Couldn't end the call cleanly"))
        }
      }
    },
    [accountId, endLocally],
  )

  const watchLink = useCallback(
    (media: AnsweredCall) => {
      const update = () => {
        if (activeRef.current?.media !== media) return
        const state = linkStateOf(media.pc.connectionState)
        setLink(state)
        if (state === "connected") setConnectedAt((at) => at ?? Date.now())
        if (state === "failed") void hangUp("Call dropped — the connection was lost")
      }
      media.pc.addEventListener("connectionstatechange", update)
      update()
    },
    [hangUp],
  )

  const answer = async (call: WhatsappCall) => {
    if (!accountId || !call.sdpOffer || answeringId || activeRef.current) return
    setAnsweringId(call.id)
    let media: AnsweredCall | null = null
    try {
      media = await answerOffer(call.sdpOffer)
      const accepted = await answerCall(accountId, call.id, media.sdpAnswer)
      const started: ActiveCall = { call: accepted, media }
      // Set before anything below can run: the caller's audio usually arrived
      // while the offer was being answered, so `remoteStream` is already
      // resolved and its callback fires before React would re-render.
      activeRef.current = started
      setActive(started)
      setNow(Date.now())
      setRinging((list) => list.filter((c) => c.id !== call.id))
      watchLink(media)
      const answered = media
      void answered.remoteStream.then((stream) => {
        if (activeRef.current?.media === answered) setRemoteStream(stream)
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

  const decline = async (call: WhatsappCall): Promise<boolean> => {
    if (!accountId) return false
    setRinging((list) => list.filter((c) => c.id !== call.id))
    try {
      await rejectCall(accountId, call.id)
      return true
    } catch (err) {
      if (getErrorStatus(err) !== 409) {
        toast.error(getErrorMessage(err, "Couldn't decline the call"))
      }
      return false
    }
  }

  const declineWithMessage = async (call: WhatsappCall, message: string) => {
    await decline(call)
    if (!accountId) return
    try {
      await sendWhatsappMessage({
        accountId,
        phoneNumberId: call.phoneNumberId,
        to: call.customerWaId,
        message,
      })
      toast.success(`Message sent to ${callerLabel(call)}`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Declined, but the message didn't send"))
    }
  }

  const toggleMute = () => {
    const current = activeRef.current
    if (!current) return
    setMuted(current.media.localStream, !muted)
    setMutedState(!muted)
  }

  const selectOutput = (deviceId: string) => {
    const el = audioRef.current
    if (!el?.setSinkId) return
    el.setSinkId(deviceId)
      .then(() => setOutputId(deviceId))
      .catch(() => toast.error("Couldn't switch to that speaker"))
  }

  const unblockAudio = () => {
    audioRef.current
      ?.play()
      .then(() => setAudioBlocked(false))
      .catch(() => toast.error("Your browser is still blocking the call audio"))
  }

  const elapsed = connectedAt === null ? null : Math.max(0, (now - connectedAt) / 1000)

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {incoming ? (
        <IncomingCallScreen
          key={incoming.id}
          call={incoming}
          waiting={ringing.length - 1}
          answering={answeringId === incoming.id}
          onAnswer={() => answer(incoming)}
          onDecline={() => void decline(incoming)}
          onDeclineWithMessage={(message) => void declineWithMessage(incoming, message)}
        />
      ) : null}

      {active && !minimized ? (
        <ActiveCallScreen
          call={active.call}
          link={link}
          elapsed={elapsed}
          muted={muted}
          remoteStream={remoteStream}
          audioBlocked={audioBlocked}
          outputs={outputs}
          outputId={outputId}
          onSelectOutput={selectOutput}
          onToggleMute={toggleMute}
          onHangUp={() => void hangUp()}
          onMinimize={() => setMinimized(true)}
          onUnblockAudio={unblockAudio}
        />
      ) : null}

      {active && minimized ? (
        <MinimizedCallBar
          call={active.call}
          link={link}
          elapsed={elapsed}
          muted={muted}
          onExpand={() => setMinimized(false)}
          onToggleMute={toggleMute}
          onHangUp={() => void hangUp()}
        />
      ) : null}
    </>
  )
}
