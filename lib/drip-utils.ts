import type { DripStep } from "@/services/api"

export const MAX_DELAY_HOURS = 2160 // 90 days
export const MAX_STEPS = 20

// Friendly rendering of a step delay.
export function formatDelay(delayHours: number): string {
  if (delayHours <= 0) return "Immediately"
  if (delayHours % 24 === 0) {
    const days = delayHours / 24
    return `${days} day${days === 1 ? "" : "s"}`
  }
  if (delayHours === 1) return "1 hour"
  return `${delayHours} hours`
}

// Cumulative time from enrollment to a given step. Step 0's delay counts from
// enrollment; each later step's delay counts from when the previous step sent.
export function cumulativeHours(steps: { delayHours: number }[], index: number): number {
  let total = 0
  for (let i = 0; i <= index && i < steps.length; i++) {
    total += Number(steps[i].delayHours) || 0
  }
  return total
}

// "Day 0", "Day 1", "Day 3" style label from cumulative hours.
export function dayLabel(cumHours: number): string {
  const days = Math.floor(cumHours / 24)
  const hours = cumHours % 24
  if (days === 0 && hours === 0) return "Day 0"
  if (hours === 0) return `Day ${days}`
  if (days === 0) return `+${hours}h`
  return `Day ${days} +${hours}h`
}

// Backend 400s: "Invalid drip steps: steps[2].templateName — ..." → 2
export function parseDripErrorStepIndex(message: string): number | null {
  const m = message.match(/steps[.[](\d+)/)
  return m ? Number(m[1]) : null
}

export function emptyStep(delayHours = 0): DripStep {
  return { delayHours, templateName: "", templateLanguage: "", templateParameters: [] }
}
