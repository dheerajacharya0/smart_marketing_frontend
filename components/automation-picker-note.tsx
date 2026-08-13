"use client"

import Link from "next/link"
import { Bot, Mails, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * "Which one do I use?" — Automation vs Flows vs Drips.
 *
 * Three separate features in the sidebar all look like "the robot that messages
 * people", and nothing on any of them says how they differ. This puts the
 * comparison on all three pages, with the one you're currently looking at
 * highlighted, so the answer arrives before you've built the wrong thing.
 *
 * Deliberately not dismissible: it's two lines per option and reads as a legend,
 * not an interruption. The definitions are the `long` text from the glossary
 * entries (`automation`, `flow`, `drip`), kept in sync by saying the same thing
 * in fewer words rather than by duplicating prose.
 */

const OPTIONS = [
  {
    id: "automation" as const,
    icon: Zap,
    title: "Automation",
    href: "/dashboard/automation",
    when: "One keyword in, one reply out.",
    example: "Someone texts \"hours\", they get your opening times.",
  },
  {
    id: "flow" as const,
    icon: Bot,
    title: "Chatbot flow",
    href: "/dashboard/flows",
    when: "A back-and-forth where the next message depends on their answer.",
    example: "Ask what they need, then branch to sales or support.",
  },
  {
    id: "drip" as const,
    icon: Mails,
    title: "Drip sequence",
    href: "/dashboard/drips",
    when: "Messages on a schedule after someone joins — no reply needed.",
    example: "Welcome now, tips on day 2, an offer on day 7.",
  },
]

export function AutomationPickerNote({
  current,
}: {
  /** Which page this is rendering on — that card is highlighted, not linked. */
  current: "automation" | "flow" | "drip"
}) {
  return (
    <section
      aria-label="Which automation feature to use"
      className="rounded-lg border bg-muted/40 p-4"
    >
      <h2 className="text-sm font-medium">Which one do I use?</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const isCurrent = option.id === current
          const Icon = option.icon
          const body = (
            <>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{option.title}</span>
                {isCurrent && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    You&apos;re here
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{option.when}</p>
              <p className="mt-1 text-xs italic text-muted-foreground/80">{option.example}</p>
            </>
          )

          const className = cn(
            "rounded-md border bg-background p-3 text-left block",
            isCurrent ? "border-primary/40" : "hover:border-foreground/20 transition-colors",
          )

          // The current page isn't a link — a link back to where you already are
          // is noise, and worse, it looks like it does something.
          return isCurrent ? (
            <div key={option.id} className={className}>
              {body}
            </div>
          ) : (
            <Link key={option.id} href={option.href} className={className}>
              {body}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
