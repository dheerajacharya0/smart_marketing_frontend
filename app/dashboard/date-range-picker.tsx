"use client"

import { useState } from "react"
import { CalendarIcon, Check, ChevronDown } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

export interface AnalyticsRange {
  from: Date
  to: Date
  label: string
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
]

export function presetRange(days: number, label: string): AnalyticsRange {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from, to, label }
}

export const DEFAULT_RANGE = () => presetRange(30, "Last 30 days")

export function DateRangePicker({
  range,
  onChange,
}: {
  range: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState<DateRange | undefined>()

  const applyPreset = (days: number, label: string) => {
    onChange(presetRange(days, label))
    setOpen(false)
    setCustomDraft(undefined)
  }

  const applyCustom = () => {
    if (!customDraft?.from) return
    const from = customDraft.from
    // A single-day pick means from==to; extend `to` to end of that day
    const toBase = customDraft.to || customDraft.from
    const to = new Date(toBase)
    to.setHours(23, 59, 59, 999)
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    onChange({ from, to, label: `${fmt(from)} – ${fmt(to)}` })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {range.label}
          <ChevronDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="p-1">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => applyPreset(p.days, p.label)}
            >
              <span className="w-5">
                {range.label === p.label && <Check className="h-4 w-4 font-bold" />}
              </span>
              {p.label}
            </Button>
          ))}
        </div>
        <Separator />
        <div className="p-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">Custom range</p>
          <Calendar
            mode="range"
            selected={customDraft}
            onSelect={setCustomDraft}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
          />
          <Button size="sm" className="w-full" disabled={!customDraft?.from} onClick={applyCustom}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
