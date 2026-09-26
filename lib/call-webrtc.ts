/**
 * The browser half of answering a WhatsApp call.
 *
 * Meta sends the caller's SDP offer; we answer it with this browser's
 * microphone and hand the answer back through our API. After that the audio
 * runs directly between this browser and Meta — our servers never carry it.
 *
 * Meta takes the answer as one complete SDP (no trickle ICE), so the answer is
 * only read once candidate gathering has finished, or after a short timeout —
 * a slow network's late candidates are worth less than answering before the
 * caller gives up.
 */

// Public STUN, so the answer carries a reachable address from behind NAT.
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]
export const ICE_GATHER_TIMEOUT_MS = 2500

export interface AnsweredCall {
  pc: RTCPeerConnection
  localStream: MediaStream
  /** Resolves with the caller's audio as soon as Meta starts sending it. */
  remoteStream: Promise<MediaStream>
  sdpAnswer: string
}

/** Resolve once ICE gathering completes, or after `timeoutMs`, whichever first. */
export function waitForIceGathering(
  pc: Pick<RTCPeerConnection, "iceGatheringState" | "addEventListener" | "removeEventListener">,
  timeoutMs = ICE_GATHER_TIMEOUT_MS,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener("icegatheringstatechange", onChange)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done()
    }
    const timer = setTimeout(done, timeoutMs)
    pc.addEventListener("icegatheringstatechange", onChange)
  })
}

/**
 * Build this browser's answer to the caller's offer. Asks for the microphone —
 * which is where an agent who has blocked it finds out, before the call is
 * claimed rather than after.
 */
export async function answerOffer(offerSdp: string): Promise<AnsweredCall> {
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  for (const track of localStream.getAudioTracks()) pc.addTrack(track, localStream)

  const remoteStream = new Promise<MediaStream>((resolve) => {
    pc.addEventListener("track", (event) => {
      resolve(event.streams[0] ?? new MediaStream([event.track]))
    })
  })

  try {
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await waitForIceGathering(pc)
    const sdpAnswer = pc.localDescription?.sdp
    if (!sdpAnswer) throw new Error("The browser produced no call answer")
    return { pc, localStream, remoteStream, sdpAnswer }
  } catch (err) {
    closeCall({ pc, localStream })
    throw err
  }
}

/** Release the microphone and the connection. Safe to call twice. */
export function closeCall(call: { pc: RTCPeerConnection; localStream: MediaStream }): void {
  for (const track of call.localStream.getTracks()) track.stop()
  if (call.pc.signalingState !== "closed") call.pc.close()
}

export function setMuted(localStream: MediaStream, muted: boolean): void {
  for (const track of localStream.getAudioTracks()) track.enabled = !muted
}
