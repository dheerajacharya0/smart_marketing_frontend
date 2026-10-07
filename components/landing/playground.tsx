"use client"

import { useState } from "react"
import { CheckCheck, CornerDownLeft, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { useInView } from "@/components/landing/effects"
import { PhoneChat } from "@/components/landing/phone"
import { WaitlistForm } from "@/components/landing/waitlist-form"
import type { ChatMessage } from "@/components/landing/use-cases-data"

/**
 * "Send your first campaign": the visitor types their business name, picks a
 * moment, and watches their own brand send a WhatsApp campaign and get a
 * reply — the product demo, before any signup. Purely client-side; nothing is
 * sent anywhere until they join the waitlist.
 */

type Moment = "festive" | "cart" | "appointment" | "restock"

const MOMENTS: { id: Moment; label: string }[] = [
  { id: "festive", label: "🪔 Festive sale" },
  { id: "cart", label: "🛒 Cart reminder" },
  { id: "appointment", label: "📅 Appointment" },
  { id: "restock", label: "✨ Back in stock" },
]

function buildScript(moment: Moment, biz: string): ChatMessage[] {
  switch (moment) {
    case "festive":
      return [
        {
          from: "biz",
          time: "6:30 PM",
          media: { title: "Diwali Sale is live 🪔", subtitle: `${biz} · up to 30% off`, gradient: "from-amber-400 via-orange-500 to-rose-500" },
          text: `Hi Priya 👋 ${biz}'s Diwali sale just went live. Your early-access code DIWALI30 works till Sunday.`,
          buttons: ["Shop the sale", "Remind me Friday"],
        },
        { from: "user", time: "6:31 PM", text: "Shop the sale" },
        { from: "biz", time: "6:31 PM", text: `Code applied ✨ Free delivery on your order today. Happy Diwali from ${biz}! 🪔`, buttons: ["Open my cart"] },
        { from: "user", time: "6:34 PM", text: "Ordered! 🎉" },
      ]
    case "cart":
      return [
        {
          from: "biz",
          time: "7:42 PM",
          media: { title: "Still in your cart", subtitle: "Complete your order in one tap", gradient: "from-blue-500 via-indigo-500 to-violet-500" },
          text: `Hi Priya, you left something at ${biz}. Here's 10% off if you check out in the next 2 hours.`,
          buttons: ["Complete my order", "Not now"],
        },
        { from: "user", time: "7:44 PM", text: "Complete my order" },
        { from: "biz", time: "7:44 PM", text: "Done ✅ 10% off applied. Pay by UPI and we ship today.", buttons: ["Pay via UPI"] },
        { from: "user", time: "7:45 PM", text: "Paid 🙌" },
      ]
    case "appointment":
      return [
        {
          from: "biz",
          time: "10:00 AM",
          text: `Hi Priya, a reminder from ${biz}: your appointment is tomorrow at 11:00 AM.`,
          buttons: ["Confirm", "Reschedule"],
        },
        { from: "user", time: "10:02 AM", text: "Confirm" },
        { from: "biz", time: "10:02 AM", text: "Thanks! See you tomorrow 😊 Reply here if anything changes." },
        { from: "user", time: "10:03 AM", text: "👍" },
      ]
    case "restock":
      return [
        {
          from: "biz",
          time: "12:15 PM",
          media: { title: "Back in stock", subtitle: "The one you asked about", gradient: "from-teal-400 via-emerald-500 to-cyan-600" },
          text: `Good news Priya — it's back at ${biz}, and we saved one for you until tonight.`,
          buttons: ["Reserve mine", "Show similar"],
        },
        { from: "user", time: "12:16 PM", text: "Reserve mine" },
        { from: "biz", time: "12:16 PM", text: "Reserved ✨ We'll hold it till 9 PM. Delivered or picked up?", buttons: ["Deliver", "Pick up"] },
        { from: "user", time: "12:17 PM", text: "Deliver please" },
      ]
  }
}

export function Playground() {
  const [name, setName] = useState("")
  const [moment, setMoment] = useState<Moment>("festive")
  const [run, setRun] = useState(0)
  const [done, setDone] = useState(false)
  // The chat starts when the phone scrolls into view, not on page load.
  const { ref, shown } = useInView<HTMLDivElement>()

  const biz = name.trim() || "Your Brand"
  const script = shown ? buildScript(moment, biz) : []

  function send(next: Moment = moment) {
    setMoment(next)
    setDone(false)
    setRun((r) => r + 1)
    // Stacked layout: the phone sits below the controls, out of sight.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-20">
      <div className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="space-y-6"
        >
          <div>
            <label htmlFor="pg-name" className="text-xs font-bold uppercase tracking-[0.16em] text-lp-subtle">
              1 · Your business name
            </label>
            <input
              id="pg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="organization"
              placeholder="e.g. Saanjh Ethnic"
              className="mt-2 h-12 w-full rounded-xl border border-lp-line-strong bg-lp-input px-4 text-[0.95rem] text-lp-fg outline-none transition placeholder:text-lp-subtle focus-visible:border-lp-accent-line focus-visible:ring-4 focus-visible:ring-blue-500/15"
            />
          </div>

          <div>
            <p id="pg-moment" className="text-xs font-bold uppercase tracking-[0.16em] text-lp-subtle">
              2 · Pick a moment
            </p>
            <div role="radiogroup" aria-labelledby="pg-moment" className="mt-2 flex flex-wrap gap-2">
              {MOMENTS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={moment === m.id}
                  onClick={() => send(m.id)}
                  className={cn(
                    "rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                    moment === m.id
                      ? "border-transparent bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.6)]"
                      : "border-lp-line bg-lp-card text-lp-text hover:border-lp-line-strong",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="lp-shine group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 px-6 text-[0.95rem] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(37,99,235,0.6)] transition active:scale-[0.98]"
          >
            <Send className="size-4 transition-transform group-hover:-rotate-12 group-hover:translate-x-0.5" />
            3 · Send it to Priya
          </button>
        </form>

        <div data-done={done} className={cn("mt-10 transition-all duration-700", done ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")} inert={!done}>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Receipt icon={<CheckCheck className="size-3.5 text-lp-subtle" />} label="Delivered" />
            <Receipt icon={<CheckCheck className="size-3.5 text-sky-500" />} label="Read" />
            <Receipt icon={<CornerDownLeft className="size-3.5 text-lp-teal" />} label="Replied" />
          </div>
          <p className="mt-4 text-lg leading-relaxed text-lp-text">
            That was one customer. Converszio sends it to <b className="text-lp-fg">your whole list</b> — and follows up with
            everyone who didn&apos;t reply.
          </p>
          <div className="mt-5">
            <WaitlistForm
              source="playground"
              cta="Send this for real"
              context={() => ({ businessName: name.trim() || undefined })}
            />
          </div>
        </div>
      </div>

      <div ref={ref} className="mx-auto">
        <PhoneChat key={`${moment}-${run}-${shown}`} business={biz} script={script} loop={false} onDone={() => shown && setDone(true)} />
        <p className="mt-4 text-center text-xs text-lp-subtle">Illustrative chat — no message is sent.</p>
      </div>
    </div>
  )
}

function Receipt({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="lp-pop inline-flex items-center gap-1.5 rounded-full border border-lp-line bg-lp-elev px-3 py-1.5 text-lp-text">
      {icon}
      {label}
    </span>
  )
}
