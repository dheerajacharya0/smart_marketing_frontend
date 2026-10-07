/**
 * User-facing text for a failed AI template generation.
 *
 * Older backends forward Gemini's raw error body as the message —
 * `{"error":{"code":503,"message":"This model is currently experiencing high
 * demand...","status":"UNAVAILABLE"}}` — under a 502, which the dialog used to
 * print verbatim. Unwrap that body when present and map the statuses that mean
 * "try again" to plain text; a clean backend message passes through as-is.
 */
import { getErrorMessage, getErrorStatus } from "@/lib/errors"

const OVERLOADED =
  "The AI model is overloaded right now. Try again in a minute, or pick Anthropic under Advanced."
const RATE_LIMITED = "The AI is rate-limited. Try again in a moment."
const TOO_SLOW =
  "The AI took too long to answer. Try again, or pick Anthropic under Advanced."
const FALLBACK = "Couldn't generate templates. Please try again."

/** Google's `{"error":{code,message}}` body, if the message is one. */
function parseUpstream(raw: string): { code?: number; message?: string } | undefined {
  if (!raw.trimStart().startsWith("{")) return undefined
  try {
    const body = JSON.parse(raw)
    const error = body?.error ?? body
    return {
      code: typeof error?.code === "number" ? error.code : undefined,
      message: typeof error?.message === "string" ? error.message : undefined,
    }
  } catch {
    return undefined
  }
}

export function aiGenerateErrorMessage(err: unknown): string {
  const status = getErrorStatus(err)
  const raw = getErrorMessage(err, "")
  const upstream = parseUpstream(raw)

  if (upstream) {
    if (upstream.code === 429) return RATE_LIMITED
    if (upstream.code === 500 || upstream.code === 503) return OVERLOADED
    return upstream.message || FALLBACK
  }
  if (status === 429) return RATE_LIMITED
  if (status === 408 || status === 504) return TOO_SLOW
  return raw || FALLBACK
}
