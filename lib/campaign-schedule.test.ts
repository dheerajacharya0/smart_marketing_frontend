import { describe, expect, it } from "vitest"
import { addDays, buildRunTimes, checkPlan, describeWeekdays, MAX_SERIES_RUNS } from "./campaign-schedule"

const everyDay = [0, 1, 2, 3, 4, 5, 6]

describe("buildRunTimes", () => {
  it("plans one send a day for a week at the chosen time", () => {
    const runs = buildRunTimes({ startDate: "2026-10-01", endDate: "2026-10-07", time: "10:00", weekdays: everyDay })
    expect(runs).toHaveLength(7)
    expect(runs[0]).toEqual(new Date(2026, 9, 1, 10, 0))
    expect(runs[6]).toEqual(new Date(2026, 9, 7, 10, 0))
  })

  it("only sends on the chosen weekdays", () => {
    // 1 Oct 2026 is a Thursday; Mon/Wed/Fri over two weeks is 6 sends.
    const runs = buildRunTimes({ startDate: "2026-10-01", endDate: "2026-10-14", time: "09:30", weekdays: [1, 3, 5] })
    expect(runs.map((d) => d.getDay())).toEqual([5, 1, 3, 5, 1, 3])
  })

  it("stops counting just past the limit so an over-long plan can be reported", () => {
    const runs = buildRunTimes({ startDate: "2026-10-01", endDate: "2026-12-31", time: "10:00", weekdays: everyDay })
    expect(runs).toHaveLength(MAX_SERIES_RUNS + 1)
  })
})

describe("checkPlan", () => {
  const now = new Date(2026, 9, 1, 8, 0)

  it("accepts a plan that starts later today", () => {
    expect(checkPlan([new Date(2026, 9, 1, 10, 0)], now)).toBeNull()
  })

  it("rejects a first send already past", () => {
    expect(checkPlan([new Date(2026, 9, 1, 7, 0)], now)).toMatch(/past/)
  })

  it("rejects an empty plan", () => {
    expect(checkPlan([], now)).toMatch(/at least one/)
  })
})

describe("addDays", () => {
  it("crosses a month end", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04")
  })
})

describe("describeWeekdays", () => {
  it("names common patterns", () => {
    expect(describeWeekdays(everyDay)).toBe("Every day")
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe("Weekdays")
    expect(describeWeekdays([5, 1, 3])).toBe("Mon, Wed, Fri")
  })
})
