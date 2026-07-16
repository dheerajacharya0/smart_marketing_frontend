// Shared helpers for analytics charts.

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Backend timelines are sparse (all-zero buckets omitted) — recharts needs a
// continuous series, so fill the gaps with zero rows. Buckets are UTC ISO
// strings; step by hour or UTC day.
export function fillBuckets<T extends { bucket: string }>(
  points: T[],
  interval: "hour" | "day",
  zero: Omit<T, "bucket">,
  range?: { from: string | Date; to: string | Date }
): T[] {
  if (points.length === 0 && !range) return []
  const step = interval === "hour" ? HOUR_MS : DAY_MS

  const floor = (ms: number) => Math.floor(ms / step) * step
  const start = floor(
    range ? new Date(range.from).getTime() : new Date(points[0].bucket).getTime()
  )
  const end = floor(
    range ? new Date(range.to).getTime() : new Date(points[points.length - 1].bucket).getTime()
  )
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return points

  const byBucket = new Map(points.map((p) => [floor(new Date(p.bucket).getTime()), p]))
  const filled: T[] = []
  // Cap the fill so a bad range can't generate an unbounded array
  const maxBuckets = interval === "hour" ? 24 * 92 : 400
  for (let t = start, i = 0; t <= end && i < maxBuckets; t += step, i++) {
    filled.push(byBucket.get(t) ?? ({ ...zero, bucket: new Date(t).toISOString() } as T))
  }
  return filled
}

// Axis/tooltip formatters — buckets are UTC, rendered in the user's local zone.
export function bucketTickFormatter(interval: "hour" | "day") {
  return (iso: string) => {
    const d = new Date(iso)
    return interval === "hour"
      ? d.toLocaleTimeString(undefined, { hour: "numeric" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
}

export function bucketLabelFormatter(interval: "hour" | "day") {
  return (iso: string) => {
    const d = new Date(iso)
    return interval === "hour"
      ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  }
}

// Range ≤ 3 days gets hourly buckets, otherwise daily.
export function intervalForRange(from: Date, to: Date): "hour" | "day" {
  return to.getTime() - from.getTime() <= 3 * DAY_MS ? "hour" : "day"
}
