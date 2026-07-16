"use client"

import { List } from "lucide-react"
import type { MessageInteractive } from "@/hooks/use-chat-messages"

// Read-only rendering of an outbound interactive message so agents can see
// exactly what was sent — chips are intentionally non-clickable.
export function InteractiveBubble({ interactive }: { interactive: MessageInteractive }) {
  return (
    <div className="space-y-2">
      {interactive.headerText && <p className="text-sm font-semibold">{interactive.headerText}</p>}
      {interactive.bodyText && (
        <p className="text-sm whitespace-pre-wrap break-words">{interactive.bodyText}</p>
      )}
      {interactive.footerText && <p className="text-xs opacity-70">{interactive.footerText}</p>}

      {interactive.kind === "buttons" && interactive.buttons && interactive.buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {interactive.buttons.map((b) => (
            <span
              key={b.id}
              className="rounded-full border border-[color:color-mix(in_srgb,currentColor_40%,transparent)] px-3 py-1 text-xs font-medium opacity-90"
            >
              {b.title}
            </span>
          ))}
        </div>
      )}

      {interactive.kind === "list" && (
        <div className="space-y-1.5 pt-1">
          {interactive.buttonText && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,currentColor_40%,transparent)] px-3 py-1 text-xs font-medium opacity-90">
              <List className="h-3 w-3" /> {interactive.buttonText}
            </span>
          )}
          {(interactive.sections || []).map((section, si) => (
            <div key={si} className="space-y-1">
              {section.title && <p className="text-xs font-semibold opacity-80">{section.title}</p>}
              <div className="flex flex-wrap gap-1.5">
                {section.rows.map((row) => (
                  <span
                    key={row.id}
                    className="rounded-md border border-[color:color-mix(in_srgb,currentColor_40%,transparent)] px-2 py-1 text-xs opacity-90"
                    title={row.description}
                  >
                    {row.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
