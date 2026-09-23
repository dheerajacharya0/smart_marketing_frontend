import { describe, expect, it } from "vitest"
import { NO_DATE, formatDate, formatDateTime, formatTime } from "@/lib/format-date"

const ISO = "2026-09-17T12:54:59.000Z"

describe("format-date", () => {
  it.each([
    ["formatDate", formatDate],
    ["formatDateTime", formatDateTime],
    ["formatTime", formatTime],
  ])("%s renders a placeholder for a missing date", (_name, fn) => {
    expect(fn(null)).toBe(NO_DATE)
    expect(fn(undefined)).toBe(NO_DATE)
    expect(fn("")).toBe(NO_DATE)
  })

  it.each([
    ["formatDate", formatDate],
    ["formatDateTime", formatDateTime],
    ["formatTime", formatTime],
  ])("%s renders a placeholder rather than 'Invalid Date'", (_name, fn) => {
    expect(fn("not a date")).toBe(NO_DATE)
  })

  // The whole point of the module: seconds are noise, and showing them is what
  // made "started 12:54:59 — completed 12:55:00" read as unfinished.
  it("never shows seconds", () => {
    expect(formatDateTime(ISO)).not.toMatch(/:\d{2}:\d{2}/)
    expect(formatTime(ISO)).not.toMatch(/:\d{2}:\d{2}/)
  })

  it("spells the month rather than using slashes", () => {
    expect(formatDate(ISO)).not.toContain("/")
    expect(formatDateTime(ISO)).not.toContain("/")
  })

  it("includes day, month and year", () => {
    const out = formatDate(ISO)
    expect(out).toMatch(/17/)
    expect(out).toMatch(/Sep/)
    expect(out).toMatch(/2026/)
  })

  it("formatDateTime is formatDate plus a time", () => {
    const dateOnly = formatDate(ISO)
    const withTime = formatDateTime(ISO)
    for (const part of dateOnly.split(/[\s,]+/).filter(Boolean)) {
      expect(withTime).toContain(part)
    }
    expect(withTime.length).toBeGreaterThan(dateOnly.length)
  })
})
