"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { META_RATES_INR } from "@/lib/savings"

/**
 * Every competitor page ends on an FAQ; ours answers the questions a
 * zero-markup claim raises.
 */
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "Does Converszio use the official WhatsApp Business Platform?",
    a: "Yes. Converszio is built on Meta's WhatsApp Business Platform (Cloud API). You connect your own number through Meta's Embedded Signup, and Meta bills your own WhatsApp Business Account for the messages.",
  },
  {
    q: "If there's no markup, how does Converszio make money?",
    a: "Meta bills your card directly, so there's nothing for us to mark up. We'll earn from optional paid plans for advanced features — never from a cut of your messages. Pricing will be published before launch.",
  },
  {
    q: "What will I pay Meta?",
    a: `Meta charges per delivered message, by category. In India that's ₹${META_RATES_INR.marketing} for marketing and ₹${META_RATES_INR.utility} for utility and authentication messages, before 18% GST. You see the cost of every message inside Converszio.`,
  },
  {
    q: "How many team members can I add?",
    a: "As many as you need. Seats are unlimited, so the whole team can work from one shared inbox without a per-seat fee.",
  },
  {
    q: "I already use another WhatsApp tool. Can I switch?",
    a: "Yes. A number that's already on the WhatsApp Business Platform can move to a new provider through Meta's number migration, and your approved templates belong to your WhatsApp Business Account, not to the tool.",
  },
  {
    q: "What can I do with it?",
    a: "Targeted campaigns and drip sequences, follow-ups that respond to customer replies, a shared team inbox, WhatsApp Flows forms, WhatsApp calling, tracked links that show attributed sales alongside campaign costs, and an API with webhooks for developers. Shopify sync is in QA.",
  },
  {
    q: "When do you launch, and what happens after I join the waitlist?",
    a: "We're opening to a small group first. Join the waitlist and you'll get one email when your seat is ready — nothing else.",
  },
]

const TYPING_MS = 900

/**
 * The FAQ as a WhatsApp chat: questions are quick replies, answers arrive
 * after a typing indicator. Answered questions leave the quick replies.
 */
export function Faq() {
  const [asked, setAsked] = useState<number[]>([])
  const [typing, setTyping] = useState(false)
  const thread = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = thread.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [asked, typing])

  useEffect(() => {
    if (!typing) return
    const t = setTimeout(() => setTyping(false), TYPING_MS)
    return () => clearTimeout(t)
  }, [typing])

  function ask(i: number) {
    if (typing) return
    setAsked((a) => [...a, i])
    setTyping(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  }

  const remaining = QUESTIONS.map((_, i) => i).filter((i) => !asked.includes(i))
  const last = asked[asked.length - 1]

  return (
    <div className="overflow-hidden rounded-3xl border border-lp-line bg-lp-elev shadow-[var(--lp-shadow)]">
      <div className="flex items-center gap-3 border-b border-lp-line bg-[var(--wa-head)] px-5 py-3.5">
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-xs font-bold text-white">CZ</span>
        <div>
          <p className="text-sm font-semibold text-[color:var(--wa-text)]">Converszio</p>
          <p className="text-xs text-[color:var(--wa-meta)]">{typing ? "typing…" : "Replies instantly"}</p>
        </div>
      </div>

      <div ref={thread} role="log" aria-live="polite" className="lp-wa-wall max-h-[460px] min-h-[260px] space-y-2.5 overflow-y-auto px-4 py-5 sm:px-6">
        <Bubble from="biz">Hi 👋 Ask me anything about Converszio — tap a question below.</Bubble>
        {asked.map((i) => (
          <div key={i} className="space-y-2.5">
            <Bubble from="user">{QUESTIONS[i].q}</Bubble>
            {!(typing && i === last) && <Bubble from="biz">{QUESTIONS[i].a}</Bubble>}
          </div>
        ))}
        {typing && (
          <div className="lp-pop flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-[var(--wa-in)] px-3.5 py-3 shadow-sm">
            {[0, 1, 2].map((d) => (
              <span key={d} className="lp-dot size-1.5 rounded-full bg-[var(--wa-meta)]" style={{ animationDelay: `${d * 150}ms` }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-lp-line p-4 sm:px-6">
        {remaining.length === 0 ? (
          <p className="text-sm text-lp-muted">That&apos;s everything. Still curious? Write to us.</p>
        ) : (
          remaining.map((i) => (
            <button
              key={i}
              type="button"
              disabled={typing}
              onClick={() => ask(i)}
              className="rounded-full border border-lp-accent-line bg-lp-accent-soft px-3.5 py-2 text-left text-sm font-medium text-lp-accent transition hover:-translate-y-0.5 hover:bg-lp-card-hover disabled:opacity-50"
            >
              {QUESTIONS[i].q}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function Bubble({ from, children }: { from: "biz" | "user"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "lp-pop w-fit max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.92rem] leading-relaxed text-[color:var(--wa-text)] shadow-sm",
        from === "user" ? "ml-auto rounded-tr-sm bg-[var(--wa-out)]" : "rounded-tl-sm bg-[var(--wa-in)]",
      )}
    >
      {children}
    </p>
  )
}
