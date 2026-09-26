/**
 * A soft ring for an incoming call, synthesised so there's no audio file to
 * ship, plus a vibration on phones. Returns a function that stops it.
 *
 * Browsers only let a page make sound once the user has interacted with it,
 * so a tab that hasn't been clicked since it loaded rings silently — the call
 * screen still shows.
 */
export function startRingtone(): () => void {
  if (typeof window === "undefined") return () => {}

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  let ctx: AudioContext | null = null
  try {
    ctx = Ctx ? new Ctx() : null
  } catch {
    ctx = null
  }

  const ring = () => {
    if (ctx && ctx.state !== "closed") {
      void ctx.resume().catch(() => undefined)
      const start = ctx.currentTime + 0.05
      // Two rising pairs, then a pause: close to a phone's ring, gentle enough
      // for an office.
      const notes: Array<[number, number]> = [
        [659.25, 0],
        [880, 0.16],
        [659.25, 0.42],
        [880, 0.58],
      ]
      for (const [freq, at] of notes) tone(ctx, freq, start + at, 0.22)
    }
    navigator.vibrate?.([400, 200, 400])
  }

  ring()
  const timer = setInterval(ring, 2600)
  return () => {
    clearInterval(timer)
    navigator.vibrate?.(0)
    void ctx?.close().catch(() => undefined)
  }
}

function tone(ctx: AudioContext, freq: number, at: number, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.16, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration + 0.05)
}
