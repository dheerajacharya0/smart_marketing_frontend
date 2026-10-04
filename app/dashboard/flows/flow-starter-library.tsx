"use client"

import { useEffect, useState } from "react"
import { StarterLibrary } from "@/components/starter-library"
import { FLOW_STARTERS } from "@/lib/flow-starters"
import { INDUSTRIES, type IndustryId } from "@/lib/industry-flows"
import { cn } from "@/lib/utils"

type Filter = IndustryId | "all"

/** Remembered per browser: a salon picks "Salon & spa" once, not every visit. */
const STORAGE_KEY = "flowStarterIndustry"

function readSaved(): Filter {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "all" || INDUSTRIES.some((i) => i.id === v)) return v as Filter
  } catch {
    // storage blocked (private window, preview) — fall back to everything
  }
  return "all"
}

/**
 * The flow starter strip with an industry filter: ready-made bots for the
 * business's own line of work, plus the general ones that fit anyone.
 */
export function FlowStarterLibrary({ disabled }: { disabled: boolean }) {
  const [filter, setFilter] = useState<Filter>("all")
  // After mount: localStorage isn't there during the server render.
  useEffect(() => setFilter(readSaved()), [])

  const pick = (next: Filter) => {
    setFilter(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // not remembered; the choice still applies on this visit
    }
  }

  // An industry view keeps the general starters after its own, so a clinic
  // still finds "Welcome menu" without switching back to All.
  const options =
    filter === "all"
      ? FLOW_STARTERS
      : [
          ...FLOW_STARTERS.filter((s) => s.industry === filter),
          ...(filter === "general" ? [] : FLOW_STARTERS.filter((s) => s.industry === "general")),
        ]

  const chips: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, ...INDUSTRIES]

  return (
    <StarterLibrary
      title="Start from a template"
      description="Working bots for your kind of business — run them in the simulator, then edit."
      basePath="/dashboard/flows/new"
      options={options}
      disabled={disabled}
      toolbar={
        <div
          role="radiogroup"
          aria-label="Industry"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="radio"
              aria-checked={filter === chip.id}
              onClick={() => pick(chip.id)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                filter === chip.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      }
    />
  )
}
