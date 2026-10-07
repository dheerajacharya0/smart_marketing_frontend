import { cn } from "@/lib/utils"

const SITE = "https://converszio.com"
const MESSAGE = `Saw this and thought of you — WhatsApp campaigns, follow-ups and a shared team inbox in one place. Launching soon: ${SITE}`

/**
 * Word of mouth through the channel we sell: opens WhatsApp with a message
 * ready to forward to another business owner. No tracking, no backend.
 */
export function ShareOnWhatsApp({ className, label = "Know a business drowning in WhatsApp chats? Send them this" }: { className?: string; label?: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(MESSAGE)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full border border-lp-line-strong bg-lp-elev py-2 pl-2 pr-4 text-sm font-semibold text-lp-fg transition hover:-translate-y-0.5 hover:border-emerald-500/50",
        className,
      )}
    >
      <span className="grid size-7 place-items-center rounded-full bg-emerald-500 text-white transition-transform group-hover:rotate-[-8deg]">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.1 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z" />
        </svg>
      </span>
      {label}
    </a>
  )
}
