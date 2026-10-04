import { Plus } from "lucide-react"
import { META_RATES_INR } from "@/lib/savings"

/**
 * Every competitor page ends on an FAQ; ours answers the questions a
 * zero-markup claim raises. Native <details>: works without JS, keyboard and
 * screen readers get it for free, and `name` makes it a one-open accordion.
 */
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "Is Converszio an official WhatsApp Business API platform?",
    a: "Yes. Converszio is built on Meta's official WhatsApp Business Platform (Cloud API). You connect your own number through Meta's Embedded Signup, and Meta bills your own WhatsApp Business Account for the messages.",
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
    a: "Broadcast campaigns and drip sequences, a shared team inbox, automated flows, WhatsApp Flows forms, WhatsApp calling, tracked links with revenue attribution, Shopify order sync, and an API with webhooks for developers.",
  },
  {
    q: "When do you launch, and what happens after I join the waitlist?",
    a: "We're opening to a small group first. Join the waitlist and you'll get one email when your seat is ready — nothing else.",
  },
]

export function Faq() {
  return (
    <div className="divide-y divide-lp-line overflow-hidden rounded-3xl border border-lp-line bg-lp-card">
      {QUESTIONS.map(({ q, a }, i) => (
        <details key={q} name="faq" open={i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left font-semibold text-lp-fg transition hover:bg-lp-card-hover sm:px-7 [&::-webkit-details-marker]:hidden">
            {q}
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-lp-line-strong text-lp-accent transition duration-300 group-open:rotate-45 group-open:border-lp-accent-line group-open:bg-lp-accent-soft">
              <Plus className="size-4" />
            </span>
          </summary>
          <p className="lp-faq-answer px-5 pb-6 leading-relaxed text-lp-muted sm:px-7">{a}</p>
        </details>
      ))}
    </div>
  )
}
