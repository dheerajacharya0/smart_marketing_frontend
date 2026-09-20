"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createVoiceCallSession } from "@/services/api"
import { getErrorMessage } from "@/lib/errors"
import { reportSilent } from "@/lib/observability"
import { voiceCallErrorHint, type VoiceCallStage } from "@/lib/voice"

/**
 * One browser call to a voice agent.
 *
 * Two hops on purpose: the backend mints a short-lived, single-use session
 * (cookie auth, ownership checked) and the audio goes straight to the voice
 * service, whose URL that response carries. The browser therefore needs no
 * credential for the voice service, and the voice service needs no view of
 * who the user is.
 *
 * ICE is not trickled: the browser gathers every candidate before it sends the
 * offer, because the voice service answers in a single POST and has nowhere to
 * put late candidates.
 */
const ICE_GATHERING_TIMEOUT_MS = 3000

export interface UseVoiceCall {
  stage: VoiceCallStage
  /** Set when the call failed; already rewritten into something actionable. */
  error: string | null
  /** The call record's id, for opening its transcript afterwards. */
  callId: string | null
  /** True from the first click until the call is over. */
  busy: boolean
  start: (agentId: string) => Promise<void>
  hangUp: () => void
  /** Attach to an <audio autoPlay> element; carries the agent's voice. */
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export function useVoiceCall(accountId: string | null | undefined): UseVoiceCall {
  const [stage, setStage] = useState<VoiceCallStage>("idle")
  const [error, setError] = useState<string | null>(null)
  const [callId, setCallId] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const teardown = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
  }, [])

  // A page navigated away from must not leave the microphone live.
  useEffect(() => () => teardown(), [teardown])

  const hangUp = useCallback(() => {
    teardown()
    setStage((s) => (s === "error" ? s : "ended"))
  }, [teardown])

  const start = useCallback(
    async (agentId: string) => {
      if (!accountId) return
      setError(null)
      setCallId(null)
      try {
        setStage("requesting-mic")
        // Asked for first: everything after this is wasted if it is denied,
        // and the browser prompt is what the person is looking at.
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        micRef.current = mic

        const session = await createVoiceCallSession({ accountId, agentId })
        setCallId(session.callId)
        if (!session.voiceServiceUrl) {
          throw new Error(
            "The backend did not say where the voice service is (VOICE_SERVICE_URL is unset)."
          )
        }

        setStage("connecting")
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        })
        pcRef.current = pc
        mic.getTracks().forEach((track) => pc.addTrack(track, mic))
        pc.ontrack = (event) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track])
          }
        }
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setStage("connected")
          if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
            // Only meaningful while we still own this connection: a hang-up
            // closes it deliberately and has already set the stage.
            if (pcRef.current === pc) hangUp()
          }
        }

        await pc.setLocalDescription(await pc.createOffer())
        await waitForIceGathering(pc)

        const res = await fetch(`${session.voiceServiceUrl.replace(/\/$/, "")}/api/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sdp: pc.localDescription?.sdp,
            type: pc.localDescription?.type,
            token: session.token,
          }),
        })
        if (!res.ok) {
          const detail = await res.text()
          throw new Error(detail || `Voice service refused the call (${res.status})`)
        }
        const answer = (await res.json()) as { sdp: string; type: RTCSdpType }
        await pc.setRemoteDescription({ sdp: answer.sdp, type: answer.type })
      } catch (err) {
        reportSilent(err, { where: "useVoiceCall.start" })
        setError(voiceCallErrorHint(getErrorMessage(err)))
        setStage("error")
        teardown()
      }
    },
    [accountId, hangUp, teardown]
  )

  return {
    stage,
    error,
    callId,
    busy: stage === "requesting-mic" || stage === "connecting" || stage === "connected",
    start,
    hangUp,
    audioRef,
  }
}

/** Resolves when ICE gathering finishes, or after a short wait. */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState !== "complete") return
      pc.removeEventListener("icegatheringstatechange", done)
      clearTimeout(timer)
      resolve()
    }
    // Bounded: a candidate that never arrives must not hold the call forever.
    // What has been gathered by now is enough on a normal network.
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", done)
      resolve()
    }, ICE_GATHERING_TIMEOUT_MS)
    pc.addEventListener("icegatheringstatechange", done)
  })
}
