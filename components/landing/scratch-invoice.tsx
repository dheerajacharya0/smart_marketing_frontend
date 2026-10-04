"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPETITORS, CONVERSZIO, formatInr, quote } from "@/lib/savings"

const MESSAGES = 25_000
/** A typical tool: the first competitor's terms, shown unbranded on the invoice. */
const theirs = quote(COMPETITORS[0], MESSAGES, "marketing")
const ours = quote(CONVERSZIO, MESSAGES, "marketing")
const REVEAL_AT = 0.45

/**
 * "Your last WhatsApp invoice" with the markup line hidden under a scratch-off
 * foil. Scratch past ~45% (or press the button) and it reveals, stamps the
 * Converszio price and fires confetti.
 */
export function ScratchInvoice() {
  const foil = useRef<HTMLCanvasElement>(null)
  const confetti = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const strokes = useRef(0)
  // Refs, not state, guard the reveal: pointer events keep arriving before the
  // re-render that would flip `revealed`, and a state updater must stay pure
  // (StrictMode runs it twice — that used to start two confetti loops on one
  // canvas, each clearing the other's frame: the flicker).
  const done = useRef(false)
  const confettiFrame = useRef(0)
  const [revealed, setRevealed] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => () => cancelAnimationFrame(confettiFrame.current), [])

  // Paint the foil.
  useEffect(() => {
    const canvas = foil.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, "#9ca3af")
    g.addColorStop(0.35, "#e5e7eb")
    g.addColorStop(0.5, "#f9fafb")
    g.addColorStop(0.65, "#d1d5db")
    g.addColorStop(1, "#9ca3af")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`
      ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5)
    }
    ctx.fillStyle = "rgba(55,65,81,0.85)"
    ctx.font = "700 13px ui-monospace, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("✦  SCRATCH HERE  ✦", width / 2, height / 2)
  }, [])

  const reveal = useCallback(() => {
    if (done.current) return
    done.current = true
    setRevealed(true)
    burst()
  }, [])

  function burst() {
    const canvas = confetti.current
    if (!canvas || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    cancelAnimationFrame(confettiFrame.current)
    const dpr = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const colors = ["#2dd4bf", "#22d3ee", "#818cf8", "#fbbf24", "#f472b6", "#a3e635"]
    const parts = Array.from({ length: 150 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 9
      return {
        x: width / 2,
        y: height * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    })
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, width, height)
      for (const p of parts) {
        p.vy += 0.32
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - t / 2200)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (t < 2200) confettiFrame.current = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, width, height)
    }
    confettiFrame.current = requestAnimationFrame(tick)
  }

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (done.current) return
    const canvas = e.currentTarget
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    ctx.globalCompositeOperation = "destination-out"
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 34
    ctx.beginPath()
    const from = last.current ?? { x, y }
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    last.current = { x, y }
    if (!started) setStarted(true)

    if (++strokes.current % 6 === 0) {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let clear = 0
      let total = 0
      for (let i = 3; i < data.length; i += 4 * 24) {
        total++
        if (data[i] === 0) clear++
      }
      if (clear / total > REVEAL_AT) reveal()
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <canvas
        ref={confetti}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-24 -inset-y-24 z-30 h-[calc(100%+12rem)] w-[calc(100%+12rem)]"
      />

      <div className={cn("relative", !started && !revealed && "lp-wiggle")}>
        {/* The torn edges are a mask, which would clip a box-shadow, hence the
            filter. The stamp sits outside it: an animating child inside a
            filter makes the browser re-rasterise the whole receipt each frame. */}
        <div className="drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]">
          <div className="lp-receipt relative select-none px-7 py-9">
            <div className="font-lcd text-center">
              <p className="text-[0.65rem] tracking-[0.35em] text-slate-500">TAX INVOICE</p>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">Your WhatsApp tool</p>
              <p className="text-xs text-slate-500">Oct 2026 · {MESSAGES.toLocaleString("en-IN")} marketing messages</p>
            </div>

            <div className="font-lcd mt-6 space-y-3 border-y border-dashed border-slate-300 py-5 text-[0.82rem]">
              <Line label="Monthly plan" value={formatInr(theirs.provider.plan)} />
              <Line label="Meta message charges" value={formatInr(theirs.metaCost)} />
              <div className="relative -mx-2 rounded-md px-2 py-1.5">
                <div
                  className={cn(
                    "flex justify-between font-bold transition-colors",
                    revealed ? "text-rose-600" : "text-slate-900",
                  )}
                >
                  <span>Platform markup ({Math.round(theirs.provider.markup * 100)}%)</span>
                  <span>{formatInr(theirs.markupCost)}</span>
                </div>
                <canvas
                  ref={foil}
                  aria-hidden="true"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    last.current = null
                    scratch(e)
                  }}
                  onPointerMove={(e) => e.buttons > 0 && scratch(e)}
                  onPointerUp={() => (last.current = null)}
                  className={cn(
                    "absolute inset-0 h-full w-full cursor-grab touch-none rounded-md transition-opacity duration-500 active:cursor-grabbing",
                    revealed && "pointer-events-none opacity-0",
                  )}
                />
              </div>
            </div>

            <div className="font-lcd mt-4 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-900">TOTAL</span>
              <span
                className={cn(
                  "text-2xl font-bold transition-colors",
                  revealed ? "text-slate-400 line-through decoration-rose-500 decoration-[3px]" : "text-slate-900",
                )}
              >
                {formatInr(theirs.total)}
              </span>
            </div>
            <p className="font-lcd mt-1 text-right text-[0.65rem] text-slate-400">+ 18% GST</p>
          </div>
        </div>
        {revealed && (
          <div className="lp-stamp pointer-events-none absolute -bottom-8 -right-6 z-10 rounded-xl border-[3px] border-teal-600 bg-[#f0fdfa] px-3 py-1.5 text-center text-teal-700 shadow-[0_12px_30px_-10px_rgba(13,148,136,0.6)]">
            <p className="font-lcd text-[0.6rem] font-bold tracking-[0.25em]">ON CONVERSZIO</p>
            <p className="font-landing text-xl font-extrabold leading-tight">{formatInr(ours.total)}</p>
            <p className="font-lcd text-[0.6rem] font-bold tracking-[0.15em]">₹0 PLAN · ₹0 MARKUP</p>
          </div>
        )}
      </div>

      <div className="mt-12 text-center" aria-live="polite">
        {revealed ? (
          <p className="text-lp-text">
            That line costs you <b className="text-lp-fg">{formatInr(theirs.markupCost)}</b> a month. Add the plan and
            you keep <b className="lp-gradient-text text-lg">{formatInr(theirs.total - ours.total)}/mo</b> on
            Converszio.
          </p>
        ) : (
          <button
            type="button"
            onClick={reveal}
            className="inline-flex items-center gap-2 py-2.5 text-sm font-medium text-lp-muted underline-offset-4 transition hover:text-lp-fg hover:underline"
          >
            <Sparkles className="size-4 text-lp-accent" />
            Can&apos;t scratch? Reveal it
          </button>
        )}
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
