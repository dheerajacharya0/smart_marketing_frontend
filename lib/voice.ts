import { VOICE_LANGUAGES, type VoiceCall } from "@/services/api"

/** `hi-IN` → "Hindi / Hinglish". Unknown codes render as themselves. */
export function voiceLanguageLabel(code: string): string {
  return VOICE_LANGUAGES.find((l) => l.code === code)?.label ?? code
}

/** Seconds → "0:45" / "2:05". Null while a call has not connected. */
export function formatCallDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—"
  const mins = Math.floor(seconds / 60)
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}

/**
 * Integer-string micros → "₹1.08". Micros are the exact value; this is for
 * display only, which is why it never feeds back into a calculation.
 */
export function formatVoiceCharge(chargeMicros: string | null | undefined): string {
  if (chargeMicros == null) return "—"
  const micros = Number(chargeMicros)
  if (!Number.isFinite(micros)) return "—"
  return `₹${(micros / 1_000_000).toFixed(2)}`
}

export type VoiceCallTone = "live" | "good" | "warn" | "bad"

/**
 * What actually happened on a call, in words a person reads once.
 *
 * `status` alone is not enough: a completed WhatsApp call that nobody picked
 * up and a completed call that went well are the same status, and a `failed`
 * call is our failure, not theirs — the distinction decides whether anyone
 * needs to do something about it.
 */
export function voiceCallOutcome(call: Pick<
  VoiceCall,
  "status" | "endReason" | "metaStatus" | "billedSeconds" | "direction"
>): { label: string; tone: VoiceCallTone } {
  if (call.status === "created") return { label: "Ringing", tone: "live" }
  if (call.status === "in_progress") return { label: "In progress", tone: "live" }

  if (call.status === "failed") {
    switch (call.endReason) {
      case "no_call_permission":
        return { label: "No call permission", tone: "warn" }
      case "provider_error":
        return { label: "Speech service failed", tone: "bad" }
      case "voice_agent_unavailable":
        return { label: "Voice service down", tone: "bad" }
      case "meta_accept_failed":
      case "meta_connect_failed":
        return { label: "WhatsApp refused the call", tone: "bad" }
      case "provider_unavailable":
        return { label: "No API keys configured", tone: "bad" }
      case "negotiation_failed":
        return { label: "Connection failed", tone: "bad" }
      default:
        return { label: "Failed", tone: "bad" }
    }
  }

  // Completed, but that only means it ended cleanly.
  if ((call.billedSeconds ?? 0) > 0) {
    if (call.endReason === "max_duration") return { label: "Ended (time limit)", tone: "warn" }
    if (call.endReason === "agent_ended_call") return { label: "Agent ended it", tone: "good" }
    if (call.endReason === "idle_timeout") return { label: "Ended (silence)", tone: "warn" }
    return { label: "Answered", tone: "good" }
  }
  if (call.metaStatus === "REJECTED") return { label: "Declined", tone: "warn" }
  if (call.direction === "outbound") return { label: "No answer", tone: "warn" }
  return { label: "Ended, nothing said", tone: "warn" }
}

/** Stage a browser call is at, for the button and the status line. */
export type VoiceCallStage =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "connected"
  | "ended"
  | "error"

export function voiceStageLabel(stage: VoiceCallStage): string {
  switch (stage) {
    case "requesting-mic":
      return "Allow microphone…"
    case "connecting":
      return "Connecting…"
    case "connected":
      return "Connected — speak"
    case "ended":
      return "Call ended"
    case "error":
      return "Call failed"
    default:
      return "Ready"
  }
}

/**
 * Turn a backend error into something a person can act on. The voice service's
 * own refusals are the common case while a deployment is half-configured, and
 * "503" tells nobody which half.
 */
export function voiceCallErrorHint(message: string): string {
  const text = message.toLowerCase()
  if (text.includes("providers not configured") || text.includes("api_key")) {
    return "The voice service has no AI provider keys yet (Anthropic, and Sarvam for Indian languages)."
  }
  if (text.includes("not configured")) {
    return "Voice is not configured on the backend: set VOICE_SERVICE_SECRET and VOICE_SERVICE_URL."
  }
  if (text.includes("failed to fetch") || text.includes("networkerror")) {
    return "The voice service is unreachable from this browser. Is it running, and is this origin in its CORS_ORIGINS?"
  }
  if (text.includes("payment required") || text.includes("402")) {
    return "The wallet is empty, and billing enforcement is on."
  }
  return message
}
