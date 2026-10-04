"use client"

import Link from "next/link"
import { Clock, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createTemplateHref } from "@/lib/return-to"
import { cn } from "@/lib/utils"
import type { WhatsappTemplate } from "@/services/api"

/** Meta is still deciding: submitted, or appealed after a rejection. */
export const isTemplateInReview = (t: WhatsappTemplate) =>
  t.status === "PENDING" || t.status === "IN_APPEAL"

/**
 * What to show where an approved template is required and the active number
 * has none — instead of an empty dropdown and a dead end.
 *
 * A template can't be written and sent in one sitting: Meta reviews it first
 * (usually minutes, up to a day). So this doesn't embed the editor. It sends
 * the user to the real one with the form open and a way back here, and if
 * something is already in review it says so, rather than asking for another.
 *
 * `templates` is the full list for the number, any status — the review and
 * rejection counts come from it.
 */
export function NoApprovedTemplates({
  templates,
  returnTo,
  className,
}: {
  templates: readonly WhatsappTemplate[]
  /** Dashboard path to come back to once the template is submitted. */
  returnTo: string
  className?: string
}) {
  const inReview = templates.filter(isTemplateInReview).length
  const rejected = templates.filter((t) => t.status === "REJECTED").length
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

  return (
    <div className={cn("space-y-3 rounded-md border border-border-subtle bg-muted/30 p-3 text-sm", className)}>
      {inReview > 0 ? (
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">{plural(inReview, "template")} waiting on Meta&apos;s review.</span>{" "}
            <span className="text-muted-foreground">
              Usually minutes, sometimes up to 24 hours. This fills in on its own once one is approved.
            </span>
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>
            <span className="font-medium">No approved template on this number yet.</span>{" "}
            <span className="text-muted-foreground">
              WhatsApp only lets a business message someone first with a template Meta has approved. Start
              from a ready-made one or write your own.
              {rejected > 0 && ` ${plural(rejected, "template")} ${rejected === 1 ? "was" : "were"} rejected — open templates to see why and resubmit.`}
            </span>
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={inReview > 0 ? "outline" : "default"}>
          <Link href={createTemplateHref(returnTo)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {inReview > 0 ? "Create another" : "Create a template"}
          </Link>
        </Button>
        {(inReview > 0 || rejected > 0) && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/templates">See template status</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
