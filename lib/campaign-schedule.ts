/** Sends one repeating broadcast may plan. Matches the backend limit. */
export const MAX_SERIES_RUNS = 31

/** How far ahead a repeating broadcast may be planned. Matches the backend. */
export const MAX_SERIES_HORIZON_DAYS = 90

/** Sunday first, matching Date.getDay(). */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export interface RepeatPlan {
  /** "YYYY-MM-DD", in the browser's time zone. */
  startDate: string
  endDate: string
  /** "HH:MM", 24-hour, in the browser's time zone. */
  time: string
  /** Days of the week to send on; 0 is Sunday. */
  weekdays: number[]
}

/** Today as "YYYY-MM-DD" in local time (not UTC, which can be a day off). */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return localDateString(new Date(y, m - 1, d + days))
}

/**
 * Every send the plan describes, as instants, in order.
 *
 * Built from local calendar dates and a wall-clock time, so "10:00 every day"
 * stays 10:00 across a daylight-saving change, which is what the customer
 * means. The server receives the instants and holds no time-zone rules.
 */
export function buildRunTimes(plan: RepeatPlan): Date[] {
  const [sy, sm, sd] = plan.startDate.split("-").map(Number)
  const [ey, em, ed] = plan.endDate.split("-").map(Number)
  const [hh, mm] = plan.time.split(":").map(Number)
  if ([sy, sm, sd, ey, em, ed, hh, mm].some((n) => !Number.isFinite(n))) return []
  const end = new Date(ey, em - 1, ed)
  const out: Date[] = []
  // Capped one past the limit, so a plan that is too long can be reported as
  // such rather than silently truncated.
  for (let day = new Date(sy, sm - 1, sd); day <= end && out.length <= MAX_SERIES_RUNS; ) {
    if (plan.weekdays.includes(day.getDay())) {
      out.push(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm))
    }
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  }
  return out
}

/** What is wrong with a plan, in words, or null when it can be sent. */
export function checkPlan(runs: Date[], now: Date = new Date()): string | null {
  if (runs.length === 0) return "Pick at least one day between the start and end dates"
  if (runs.length > MAX_SERIES_RUNS) return `At most ${MAX_SERIES_RUNS} sends — shorten the dates or pick fewer days`
  if (runs[0].getTime() <= now.getTime()) return "The first send is in the past — pick a later time or start tomorrow"
  const horizon = now.getTime() + MAX_SERIES_HORIZON_DAYS * 24 * 60 * 60 * 1000
  if (runs[runs.length - 1].getTime() > horizon) return `Plan at most ${MAX_SERIES_HORIZON_DAYS} days ahead`
  return null
}

/** "Every day", "Weekdays", "Mon, Wed, Fri" — the plan's days in words. */
export function describeWeekdays(weekdays: number[]): string {
  const set = [...new Set(weekdays)].sort()
  if (set.length === 7) return "Every day"
  if (set.join() === "1,2,3,4,5") return "Weekdays"
  if (set.join() === "0,6") return "Weekends"
  return set.map((d) => WEEKDAYS[d]).join(", ")
}
