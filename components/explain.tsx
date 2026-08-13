"use client"

import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getGlossaryEntry, type GlossaryTerm } from "@/lib/glossary"
import { cn } from "@/lib/utils"

/**
 * Inline plain-language explanation of a Meta/WhatsApp term.
 *
 * The app shows a lot of jargon a small-business owner has never met — WABA,
 * quality rating, messaging tier, 24-hour window. This puts the definition one
 * hover (or tap, or keyboard focus) away, without a modal and without pushing
 * the term itself off screen.
 *
 * Two shapes:
 * - `<Explain term="waba">your WhatsApp Business Account</Explain>` — wraps
 *   existing copy in a dotted underline.
 * - `<Explain term="waba" />` — renders a small `?` icon, for table headers and
 *   form labels where the label text shouldn't change.
 *
 * Definitions live in `lib/glossary.ts` and are shared with /dashboard/glossary,
 * so the hover text and the glossary page can't disagree.
 *
 * Accessibility: the trigger is a real `<button type="button">`, so it's
 * reachable by keyboard and Radix opens the tooltip on focus as well as hover.
 * That also makes it work on touch, where hover doesn't exist.
 */
export function Explain({
  term,
  children,
  className,
  side = "top",
}: {
  term: GlossaryTerm
  /** Copy to underline. Omit for the standalone `?` icon. */
  children?: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}) {
  const entry = getGlossaryEntry(term)
  // Unreachable while `term` is typed to the union, but a stale slug after an
  // edit shouldn't blank out the label it was wrapping.
  if (!entry) return <>{children ?? null}</>

  const iconOnly = children === undefined

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // Tooltips are supplementary, never the only source of the
            // information, so this doesn't need to be in the tab flow for a
            // screen reader to make sense of the page — but it is, because
            // keyboard users get no hover at all.
            aria-label={`What is ${entry.term}?`}
            className={cn(
              "inline items-baseline text-left align-baseline",
              iconOnly
                ? "ml-1 inline-flex translate-y-[1px] text-muted-foreground hover:text-foreground"
                : "underline decoration-dotted decoration-muted-foreground underline-offset-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
              className,
            )}
          >
            {iconOnly ? <HelpCircle className="h-3.5 w-3.5" /> : children}
          </button>
        </TooltipTrigger>
        {/*
          Text only, deliberately. A link in here would be unreachable by
          keyboard — tabbing away from the trigger blurs it and Radix closes the
          tooltip — and interactive content inside an aria-describedby target is
          an accessibility anti-pattern. The full entry lives on
          /dashboard/glossary, linked from Documentation and the sidebar.
        */}
        <TooltipContent side={side} className="max-w-xs">
          <p className="font-medium">{entry.term}</p>
          <p className="mt-1 text-xs font-normal leading-relaxed text-popover-foreground/80">
            {entry.short}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
