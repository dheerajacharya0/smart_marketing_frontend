"use client"

import { useEffect, useRef, useState } from "react"
import { BadgeCheck, CheckCheck, ChevronLeft, Phone as PhoneIcon, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/components/landing/use-cases-data"

const TYPING_MS = 1000
const GAP_MS = 1150
const HOLD_MS = 4200

/**
 * A WhatsApp chat that plays its script message by message — typing dots
 * before each business reply — then holds and loops. Remount (via `key`) to
 * switch scripts.
 */
export function PhoneChat({
  business,
  script,
  className,
}: {
  business: string
  script: ChatMessage[]
  className?: string
}) {
  const [count, setCount] = useState(0)
  const [typing, setTyping] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setCount(script.length)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    if (count >= script.length) {
      timer = setTimeout(() => setCount(0), HOLD_MS)
    } else if (script[count].from === "biz") {
      setTyping(true)
      timer = setTimeout(() => {
        setTyping(false)
        setCount((c) => c + 1)
      }, count === 0 ? 700 : TYPING_MS)
    } else {
      timer = setTimeout(() => setCount((c) => c + 1), GAP_MS)
    }
    return () => clearTimeout(timer)
  }, [count, script])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [count, typing])

  const initials = business
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")

  return (
    <div
      className={cn(
        "relative h-[600px] w-[296px] shrink-0 rounded-[3rem] border border-white/15 bg-[#0d0f14] p-2.5",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_50px_100px_-30px_rgba(0,0,0,0.9),0_0_80px_-20px_rgba(45,212,191,0.35)]",
        className,
      )}
    >
      {/* Side buttons */}
      <span aria-hidden="true" className="absolute -left-[3px] top-28 h-10 w-[3px] rounded-l bg-white/15" />
      <span aria-hidden="true" className="absolute -left-[3px] top-44 h-16 w-[3px] rounded-l bg-white/15" />
      <span aria-hidden="true" className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-white/15" />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[2.4rem] bg-[var(--wa-wall)]">
        {/* Dynamic island */}
        <div aria-hidden="true" className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

        {/* WhatsApp header */}
        <div className="relative z-10 flex items-center gap-2 bg-[var(--wa-head)] px-3 pb-2.5 pt-10">
          <ChevronLeft className="size-5 text-[color:var(--wa-meta)]" />
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-blue-500 text-[0.7rem] font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[0.8rem] font-semibold text-[color:var(--wa-text)]">
              {business}
              <BadgeCheck className="size-3.5 shrink-0 fill-emerald-500 text-[color:var(--wa-head)]" />
            </p>
            <p className="text-[0.65rem] text-[color:var(--wa-meta)]">{typing ? "typing…" : "Business account"}</p>
          </div>
          <Video className="size-4 text-[color:var(--wa-meta)]" />
          <PhoneIcon className="ml-3 size-4 text-[color:var(--wa-meta)]" />
        </div>

        {/* Messages */}
        <div ref={scroller} className="lp-wa-wall flex-1 space-y-2 overflow-hidden px-2.5 py-3" aria-live="polite">
          <p className="mx-auto w-fit rounded-md bg-[var(--wa-chip)] px-2 py-0.5 text-[0.6rem] font-medium text-[color:var(--wa-meta)] shadow-sm">TODAY</p>
          {script.slice(0, count).map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {typing && (
            <div className="lp-pop flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-[var(--wa-in)] px-3 py-2.5 shadow-sm">
              {[0, 1, 2].map((d) => (
                <span key={d} className="lp-dot size-1.5 rounded-full bg-[var(--wa-meta)]" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 bg-[var(--wa-wall)] px-2.5 pb-4 pt-2">
          <div className="h-9 flex-1 rounded-full bg-[var(--wa-in)] px-4 text-[0.7rem] leading-9 text-[color:var(--wa-meta)]">Message</div>
          <span className="grid size-9 place-items-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}

function Bubble({ message: m }: { message: ChatMessage }) {
  if (m.from === "user") {
    return (
      <div className="lp-pop ml-auto w-fit max-w-[78%] rounded-xl rounded-tr-sm bg-[var(--wa-out)] px-2.5 py-1.5 text-[0.74rem] leading-snug text-[color:var(--wa-text)] shadow-sm">
        {m.text}
        <span className="ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[0.55rem] text-[color:var(--wa-meta)]">
          {m.time}
          <CheckCheck className="size-3 text-sky-400" />
        </span>
      </div>
    )
  }
  return (
    <div className="lp-pop w-[86%]">
      <div className="overflow-hidden rounded-xl rounded-tl-sm bg-[var(--wa-in)] shadow-sm">
        {m.media && (
          <div className={cn("relative m-1 mb-0 h-24 overflow-hidden rounded-lg bg-gradient-to-br p-2.5", m.media.gradient)}>
            <div aria-hidden="true" className="absolute -right-6 -top-6 size-20 rounded-full bg-white/25 blur-xl" />
            <p className="relative text-[0.85rem] font-bold leading-tight text-white drop-shadow">{m.media.title}</p>
            <p className="relative mt-0.5 text-[0.62rem] font-medium text-white/90">{m.media.subtitle}</p>
          </div>
        )}
        <p className="px-2.5 pb-1 pt-1.5 text-[0.74rem] leading-snug text-[color:var(--wa-text)]">{m.text}</p>
        <p className="px-2.5 pb-1.5 text-right text-[0.55rem] text-[color:var(--wa-meta)]">{m.time}</p>
      </div>
      {m.buttons?.map((b) => (
        <div
          key={b}
          className="mt-0.5 rounded-lg bg-[var(--wa-in)] py-1.5 text-center text-[0.72rem] font-medium text-[color:var(--wa-btn)] shadow-sm"
        >
          {b}
        </div>
      ))}
    </div>
  )
}
