/**
 * The tone that plays when a customer messages you.
 *
 * Synthesised with Web Audio rather than shipped as an .mp3 on purpose: it is
 * two oscillator notes and an envelope, so there is no binary in the repo, no
 * extra request, and nothing to add to the CSP's `media-src`.
 *
 * Everything that can be decided without an AudioContext lives here as a pure
 * function, because the interesting rules — is it muted, has one just played,
 * was this our own outbound message — are the ones worth testing, and jsdom has
 * no audio.
 */

const MUTE_KEY = "notification-sound-muted"

/**
 * Minimum gap between tones.
 *
 * A campaign reply burst arrives as a dozen socket frames in a second or two.
 * Without this the tone machine-guns, which is worse than silence — the point
 * of the sound is "something arrived", not "here is a count".
 */
export const THROTTLE_MS = 1500

/** Reading `localStorage` throws in a private window with site data blocked. */
export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
  } catch {
    // A preference that cannot be saved is still worth honouring for this tab,
    // so callers keep their own state and this is best-effort.
  }
}

/**
 * Whether a tone is due.
 *
 * Kept separate from playing it so the rules can be tested: muted wins over
 * everything, and a tone within the throttle window is dropped rather than
 * queued — a delayed ding describes a message that already arrived.
 */
export function shouldPlay({
  muted,
  now,
  lastPlayedAt,
  throttleMs = THROTTLE_MS,
}: {
  muted: boolean
  now: number
  /** null when nothing has played yet this session. */
  lastPlayedAt: number | null
  throttleMs?: number
}): boolean {
  if (muted) return false
  if (lastPlayedAt === null) return true
  return now - lastPlayedAt >= throttleMs
}

/** The two notes, in order. A rising pair reads as "arrived" rather than "error". */
const NOTES = [
  { freq: 880, start: 0, duration: 0.12 },
  { freq: 1318.5, start: 0.09, duration: 0.16 },
] as const

const PEAK_GAIN = 0.12

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (context) return context
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
    return context
  } catch {
    return null
  }
}

/**
 * Play the tone. Never throws and never returns a rejected promise: a failure
 * here is a missing sound, not a broken inbox.
 *
 * Browsers refuse to start an AudioContext before the page has been interacted
 * with, so a tone that arrives before the first click is dropped. That is the
 * correct outcome — the alternative is asking permission for something the user
 * has not shown they want.
 */
export function playNotificationTone(): void {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    // `resume()` is asynchronous, so the state is still "suspended" on the very
    // next line — an early return here silently dropped the first tone of every
    // session, which is the one that proves the feature works. Play in the
    // continuation instead; it rejects if no gesture has unblocked audio yet.
    void ctx.resume().then(() => emit(ctx)).catch(() => {})
    return
  }
  emit(ctx)
}

function emit(ctx: AudioContext): void {
  const now = ctx.currentTime
  for (const note of NOTES) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = note.freq

    // A ramped envelope, not a raw start/stop: a square-edged gate on a sine
    // clicks, and the click is the part people find unpleasant.
    const startAt = now + note.start
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration)

    osc.connect(gain).connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + note.duration + 0.02)
  }
}

/**
 * Let the browser know audio is wanted, on the first real interaction.
 *
 * Without this the AudioContext stays suspended until something else happens to
 * resume it, and the first few messages of a session arrive silently. Returns a
 * cleanup function.
 */
export function unlockAudioOnFirstGesture(): () => void {
  if (typeof window === "undefined") return () => {}
  let done = false
  const unlock = () => {
    if (done) return
    done = true
    const ctx = getContext()
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {})
    remove()
  }
  const remove = () => {
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
  }
  window.addEventListener("pointerdown", unlock, { once: false })
  window.addEventListener("keydown", unlock, { once: false })
  return remove
}
