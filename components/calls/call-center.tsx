"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { useAccountId } from "@/hooks/use-account-id"
import { useChatSocket } from "@/hooks/use-chat-socket"
import {
  answerCall,
  getCall,
  getRingingCalls,
  hangupCall,
  rejectCall,
  sendWhatsappMessage,
  startCall,
  type WhatsappCall,
} from "@/services/api"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import {
  applyCallUpdate,
  callerLabel,
  dialStatusText,
  endedLabelFor,
  formatCallDuration,
  isFinalCall,
  linkStateOf,
  type CallLinkState,
} from "@/lib/calls"
import {
  answerOffer,
  applyAnswer,
  closeCall,
  makeOffer,
  setMuted,
  switchInput,
  type AnsweredCall,
  type CallMedia,
  type OfferedCall,
} from "@/lib/call-webrtc"
import { onDial, type DialTarget } from "@/lib/call-dialer"
import { defaultRoute, newlyConnected, routesFrom, type RouteOption } from "@/lib/call-audio-route"
import { startRingtone } from "@/lib/ringtone"
import {
  CallScreen,
  MinimizedCallBar,
  type AudioOutput,
  type CallPhase,
} from "@/components/calls/call-screen"

interface ActiveCall {
  call: WhatsappCall
  media: CallMedia
}

interface EndedCall {
  call: WhatsappCall
  label: string
}

type SinkableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }

/** How long "Call ended" stays up before the screen fades (matches its CSS). */
const ENDED_HOLD_MS = 1500

/**
 * How often an outgoing call asks for its own state until it connects — the
 * backstop for a socket event (the customer's answer above all) that never
 * arrived. The socket is still what normally moves the call along.
 */
const OUTBOUND_POLL_MS = 2500

/**
 * WhatsApp calls, on every dashboard page: one call screen that rings,
 * connects, carries the call and says goodbye without ever unmounting in
 * between, and a bar to return to it while working elsewhere.
 *
 * Incoming: every dashboard on the account rings together (the backend
 * broadcasts each call's state over the shared socket); the first to answer
 * takes it and the rest stop ringing on the update that follows.
 *
 * Outgoing: a Call button anywhere asks for one through `dial()`
 * (lib/call-dialer.ts). This browser makes the offer, Meta rings the customer
 * and their answer comes back over the socket. One call at a time either way.
 *
 * Audio runs directly between this browser and Meta.
 */
export function CallCenter() {
  const { accountId } = useAccountId()
  const [ringing, setRinging] = useState<WhatsappCall[]>([])
  // The call being answered, kept apart from `ringing`: the socket drops it
  // from that list the moment the backend marks it active, which is before
  // our own answer request has returned.
  const [answering, setAnswering] = useState<WhatsappCall | null>(null)
  // An outgoing call between the Call click and Meta accepting it: the
  // microphone and offer take a couple of seconds, and the screen should be
  // up for all of them.
  const [pendingDial, setPendingDial] = useState<WhatsappCall | null>(null)
  const [active, setActive] = useState<ActiveCall | null>(null)
  const [ended, setEnded] = useState<EndedCall | null>(null)
  const [muted, setMutedState] = useState(false)
  const [link, setLink] = useState<CallLinkState>("connecting")
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [outputs, setOutputs] = useState<AudioOutput[]>([])
  const [outputId, setOutputId] = useState("default")
  // Android: earpiece / speaker / headsets, chosen through the microphone.
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [routeId, setRouteId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Read by socket handlers and promise callbacks that outlive a render, so
  // they are written the moment things change — not on the next render.
  const activeRef = useRef<ActiveCall | null>(null)
  const answeringRef = useRef<WhatsappCall | null>(null)
  const pendingDialRef = useRef<WhatsappCall | null>(null)
  // Whether the outgoing call on screen has had the customer's answer applied.
  const answerAppliedRef = useRef(false)
  const syncOutboundRef = useRef<(update: WhatsappCall) => void>(() => undefined)
  const cancelledRef = useRef(false)
  const connectedAtRef = useRef<number | null>(null)
  const shownRingingRef = useRef<WhatsappCall | null>(null)
  const audioRef = useRef<SinkableAudio>(null)
  const routesRef = useRef<RouteOption[]>([])
  const routeIdRef = useRef<string | null>(null)

  const showEnded = useCallback((call: WhatsappCall, label: string) => {
    setEnded({ call, label })
  }, [])

  // Clear the ended screen once it has faded.
  useEffect(() => {
    if (!ended) return
    const timer = setTimeout(() => setEnded(null), ENDED_HOLD_MS)
    return () => clearTimeout(timer)
  }, [ended])

  const endLocally = useCallback(
    (label = "Call ended") => {
      const current = activeRef.current
      if (current) {
        closeCall(current.media)
        const at = connectedAtRef.current
        showEnded(
          current.call,
          at === null ? label : `${label} · ${formatCallDuration((Date.now() - at) / 1000)}`,
        )
      }
      activeRef.current = null
      connectedAtRef.current = null
      if (audioRef.current) audioRef.current.srcObject = null
      setActive(null)
      setMutedState(false)
      setLink("connecting")
      setConnectedAt(null)
      setRemoteStream(null)
      setAudioBlocked(false)
      setMinimized(false)
      routesRef.current = []
      routeIdRef.current = null
      setRoutes([])
      setRouteId(null)
    },
    [showEnded],
  )

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
        const update = msg.call
        setRinging((list) => applyCallUpdate(list, update))

        // The call on screen stopped ringing without us touching it: the
        // caller gave up, or a teammate picked it up.
        const shown = shownRingingRef.current
        if (
          shown?.id === update.id &&
          update.status !== "ringing" &&
          answeringRef.current?.id !== update.id &&
          activeRef.current?.call.id !== update.id
        ) {
          showEnded(shown, update.status === "active" ? "Answered by a teammate" : "Missed call")
        }

        const current = activeRef.current
        if (!current || current.call.id !== update.id) return
        if (current.call.direction === "outbound") {
          // Ringing, picked up, the customer's answer, or the end.
          syncOutboundRef.current(update)
        } else if (isFinalCall(update)) {
          // The customer hung up, or Meta ended it, while we were on the line.
          endLocally(endedLabelFor(update))
        }
      },
      [endLocally, showEnded],
    ),
    loadRinging,
  )

  const hangUp = useCallback(
    async (label?: string) => {
      const current = activeRef.current
      if (!accountId || !current) return
      endLocally(label)
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
    (media: CallMedia) => {
      const update = () => {
        if (activeRef.current?.media !== media) return
        const state = linkStateOf(media.pc.connectionState)
        setLink(state)
        if (state === "connected" && connectedAtRef.current === null) {
          connectedAtRef.current = Date.now()
          setConnectedAt(connectedAtRef.current)
        }
        if (state === "failed") void hangUp("Call dropped")
      }
      media.pc.addEventListener("connectionstatechange", update)
      update()
    },
    [hangUp],
  )

  // An update for the outgoing call on screen, from the socket or the poll.
  syncOutboundRef.current = (update: WhatsappCall) => {
    const current = activeRef.current
    if (!current || current.call.id !== update.id) return
    if (isFinalCall(update)) {
      endLocally(endedLabelFor(update))
      return
    }
    const next: ActiveCall = {
      ...current,
      call: { ...update, customerName: update.customerName ?? current.call.customerName },
    }
    activeRef.current = next
    setActive(next)
    if (update.sdpAnswer && !answerAppliedRef.current) {
      answerAppliedRef.current = true
      applyAnswer(current.media.pc, update.sdpAnswer).catch(() => {
        void hangUp("Call failed")
      })
    }
  }

  // Start at the ear (or on headphones), like a phone call — Chrome on
  // Android would otherwise pick the loudspeaker.
  const pickRoute = (devices: MediaDeviceInfo[]) => {
    routesRef.current = routesFrom(devices)
    routeIdRef.current = defaultRoute(routesRef.current)?.deviceId ?? null
    return routeIdRef.current
  }

  const placeCall = async (target: DialTarget) => {
    if (!accountId) return
    if (activeRef.current || answeringRef.current || pendingDialRef.current) {
      toast("Finish the current call first")
      return
    }
    const placeholder: WhatsappCall = {
      id: `dial-${Date.now()}`,
      accountId,
      phoneNumberId: target.phoneNumberId,
      metaCallId: "",
      direction: "outbound",
      customerWaId: target.customerWaId,
      customerName: target.customerName ?? null,
      conversationId: target.conversationId ?? null,
      status: "dialing",
      sdpOffer: null,
      answeredByUserId: null,
      answeredAt: null,
      endedAt: null,
      durationSeconds: null,
      endReason: null,
      createdAt: new Date().toISOString(),
    }
    pendingDialRef.current = placeholder
    cancelledRef.current = false
    setEnded(null)
    setMinimized(false)
    setPendingDial(placeholder)
    let media: OfferedCall | null = null
    try {
      media = await makeOffer(pickRoute)
      if (cancelledRef.current) {
        closeCall(media)
        return
      }
      const placed = await startCall({
        accountId,
        phoneNumberId: target.phoneNumberId,
        customerWaId: target.customerWaId,
        sdp: media.sdpOffer,
      })
      if (cancelledRef.current) {
        // Hung up while Meta was placing it: cancel it there too.
        closeCall(media)
        await hangupCall(accountId, placed.id).catch(() => undefined)
        return
      }
      const started: ActiveCall = {
        call: {
          ...placed,
          customerName: placed.customerName ?? placeholder.customerName,
          conversationId: placed.conversationId ?? placeholder.conversationId,
        },
        media,
      }
      answerAppliedRef.current = false
      activeRef.current = started
      setActive(started)
      setRoutes(routesRef.current)
      setRouteId(routeIdRef.current)
      setNow(Date.now())
      watchLink(media)
      const offered = media
      void offered.remoteStream.then((stream) => {
        if (activeRef.current?.media === offered) setRemoteStream(stream)
      })
      // The answer can beat our own request home.
      if (placed.sdpAnswer || isFinalCall(placed)) syncOutboundRef.current(placed)
    } catch (err) {
      if (media) closeCall(media)
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        showEnded(placeholder, "Microphone blocked")
        toast.error("Allow microphone access in your browser to make calls")
      } else if (getErrorStatus(err) === 409) {
        showEnded(placeholder, "Can't call yet")
        toast.error(getErrorMessage(err, "This customer hasn't allowed calls from your business yet"))
      } else {
        showEnded(placeholder, "Couldn't call")
        toast.error(getErrorMessage(err, "Couldn't place the call"))
      }
    } finally {
      pendingDialRef.current = null
      setPendingDial(null)
    }
  }

  // Call buttons elsewhere in the dashboard reach this through `dial()`.
  const placeCallRef = useRef(placeCall)
  placeCallRef.current = placeCall
  useEffect(() => onDial((target) => void placeCallRef.current(target)), [])

  // Backstop for the socket while an outgoing call waits to connect.
  const waitingOutboundId =
    active?.call.direction === "outbound" && connectedAt === null ? active.call.id : null
  useEffect(() => {
    if (!accountId || !waitingOutboundId) return
    const timer = setInterval(() => {
      getCall(accountId, waitingOutboundId)
        .then((update) => syncOutboundRef.current(update))
        .catch(() => undefined)
    }, OUTBOUND_POLL_MS)
    return () => clearInterval(timer)
  }, [accountId, waitingOutboundId])

  const answer = async (call: WhatsappCall) => {
    if (!accountId || !call.sdpOffer || answeringRef.current || activeRef.current) return
    answeringRef.current = call
    cancelledRef.current = false
    setAnswering(call)
    let media: AnsweredCall | null = null
    try {
      media = await answerOffer(call.sdpOffer, pickRoute)
      if (cancelledRef.current) {
        // Ended while the microphone was being set up: nothing was claimed yet.
        closeCall(media)
        await rejectCall(accountId, call.id).catch(() => undefined)
        return
      }
      const accepted = await answerCall(accountId, call.id, media.sdpAnswer)
      if (cancelledRef.current) {
        closeCall(media)
        await hangupCall(accountId, call.id).catch(() => undefined)
        return
      }
      const started: ActiveCall = { call: accepted, media }
      // Set before anything below can run: the caller's audio usually arrived
      // while the offer was being answered, so `remoteStream` is already
      // resolved and its callback fires before React would re-render.
      activeRef.current = started
      setActive(started)
      setRoutes(routesRef.current)
      setRouteId(routeIdRef.current)
      setNow(Date.now())
      setRinging((list) => list.filter((c) => c.id !== call.id))
      watchLink(media)
      const answered = media
      void answered.remoteStream.then((stream) => {
        if (activeRef.current?.media === answered) setRemoteStream(stream)
      })
    } catch (err) {
      if (media) closeCall(media)
      setRinging((list) => list.filter((c) => c.id !== call.id))
      if (getErrorStatus(err) === 409) {
        showEnded(call, "Answered by a teammate")
      } else if (err instanceof DOMException && err.name === "NotAllowedError") {
        showEnded(call, "Microphone blocked")
        toast.error("Allow microphone access in your browser to take calls")
      } else {
        showEnded(call, "Couldn't connect")
        toast.error(getErrorMessage(err, "Couldn't answer the call"))
      }
    } finally {
      answeringRef.current = null
      setAnswering(null)
    }
  }

  const decline = async (call: WhatsappCall): Promise<void> => {
    if (!accountId) return
    setRinging((list) => list.filter((c) => c.id !== call.id))
    showEnded(call, "Call declined")
    try {
      await rejectCall(accountId, call.id)
    } catch (err) {
      if (getErrorStatus(err) !== 409) {
        toast.error(getErrorMessage(err, "Couldn't decline the call"))
      }
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

  const endCall = () => {
    const dialing = pendingDialRef.current
    if (dialing && !activeRef.current) {
      // Still setting up: `placeCall` sees the flag and backs out.
      cancelledRef.current = true
      pendingDialRef.current = null
      setPendingDial(null)
      showEnded(dialing, "Call cancelled")
      return
    }
    const current = activeRef.current
    if (current?.call.direction === "outbound" && connectedAtRef.current === null) {
      void hangUp("Call cancelled")
      return
    }
    const pending = answeringRef.current
    if (pending && !activeRef.current) {
      // Still connecting: `answer` sees the flag and backs out.
      cancelledRef.current = true
      setRinging((list) => list.filter((c) => c.id !== pending.id))
      showEnded(pending, "Call ended")
      return
    }
    void hangUp()
  }

  const toggleMute = () => {
    const current = activeRef.current
    if (!current) return
    setMuted(current.media.localStream, !muted)
    setMutedState(!muted)
  }

  const selectRoute = useCallback((deviceId: string) => {
    const current = activeRef.current
    if (!current || deviceId === routeIdRef.current) return
    const previous = routeIdRef.current
    routeIdRef.current = deviceId
    setRouteId(deviceId)
    switchInput(current.media, deviceId).catch(() => {
      routeIdRef.current = previous
      setRouteId(previous)
      toast.error("Couldn't switch the audio")
    })
  }, [])

  // Headphones plugged in or paired mid-call take over, as on a phone; if the
  // one in use disappears, fall back to the earpiece.
  useEffect(() => {
    if (!active || routes.length === 0 || !navigator.mediaDevices?.addEventListener) return
    const onChange = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const next = routesFrom(devices)
          if (next.length === 0) return
          const added = newlyConnected(routesRef.current, next)
          routesRef.current = next
          setRoutes(next)
          if (added) selectRoute(added.deviceId)
          else if (!next.some((r) => r.deviceId === routeIdRef.current)) {
            const fallback = defaultRoute(next)
            if (fallback) selectRoute(fallback.deviceId)
          }
        })
        .catch(() => undefined)
    }
    navigator.mediaDevices.addEventListener("devicechange", onChange)
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange)
  }, [active, routes.length, selectRoute])

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

  // What's on screen. One screen per call id, so ringing → connecting →
  // talking → ended re-renders in place instead of remounting.
  let screenCall: WhatsappCall | null = null
  let phase: CallPhase = "incoming"
  if (ended) {
    screenCall = ended.call
    phase = "ended"
  } else if (active) {
    screenCall = active.call
    phase = "active"
  } else if (answering) {
    screenCall = answering
    phase = "connecting"
  } else if (pendingDial) {
    screenCall = pendingDial
    phase = "connecting"
  } else if (ringing[0]) {
    screenCall = ringing[0]
    phase = "incoming"
  }
  shownRingingRef.current = phase === "incoming" ? screenCall : null

  // Ring — sound, vibration and a flashing tab title — while a call waits.
  const ringingNow = phase === "incoming" && screenCall !== null
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

  // Speakers and headsets the caller's audio can play on. Only where the
  // browser lets a page choose (desktop Chrome/Edge); phone browsers route
  // call audio themselves.
  useEffect(() => {
    const el = audioRef.current
    if (
      !active ||
      routes.length > 0 ||
      !el ||
      typeof el.setSinkId !== "function" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
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
  }, [active, routes.length])

  // Release the microphone if the page is left mid-call.
  useEffect(
    () => () => {
      if (activeRef.current) closeCall(activeRef.current.media)
    },
    [],
  )

  const elapsed = connectedAt === null ? null : Math.max(0, (now - connectedAt) / 1000)
  const waiting = ringing.filter((c) => c.id !== screenCall?.id).length
  const shown = screenCall
  const dialStatus = active ? dialStatusText(active.call) : pendingDial ? "Calling…" : null
  // Keyed per call, except that an outgoing call changes id when Meta accepts
  // the placeholder — keep that one screen mounted through it.
  const screenKey = shown?.direction === "outbound" ? "outbound" : shown?.id

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {shown && !(phase === "active" && minimized) ? (
        <CallScreen
          key={screenKey}
          call={shown}
          phase={phase}
          waiting={waiting}
          link={link}
          elapsed={elapsed}
          endedLabel={ended?.label ?? "Call ended"}
          dialStatus={phase === "ended" ? null : dialStatus}
          muted={muted}
          remoteStream={remoteStream}
          audioBlocked={audioBlocked}
          outputs={
            routes.length > 0
              ? routes.map((r) => ({ deviceId: r.deviceId, label: r.label, kind: r.route }))
              : outputs
          }
          outputId={routes.length > 0 ? (routeId ?? "") : outputId}
          onAnswer={() => void answer(shown)}
          onDecline={() => void decline(shown)}
          onDeclineWithMessage={(message) => void declineWithMessage(shown, message)}
          onSelectOutput={routes.length > 0 ? selectRoute : selectOutput}
          onToggleMute={toggleMute}
          onHangUp={endCall}
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
          dialStatus={dialStatus}
          onExpand={() => setMinimized(false)}
          onToggleMute={toggleMute}
          onHangUp={endCall}
        />
      ) : null}
    </>
  )
}
