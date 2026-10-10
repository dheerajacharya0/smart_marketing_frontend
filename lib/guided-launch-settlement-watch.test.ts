import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  FAST_INTERVAL_MS,
  FAST_PHASE_MS,
  startGuidedLaunchSettlementWatch,
  WATCH_LIMIT_MS,
} from "./guided-launch-settlement-watch"

type L = { status: string }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(statuses: (string | null | Error)[], key = "acc-1") {
  let i = 0
  const fetchGuidedLaunch = vi.fn(async (): Promise<L | null> => {
    const next = statuses[Math.min(i++, statuses.length - 1)]
    if (next instanceof Error) throw next
    return next === null ? null : { status: next }
  })
  const onSettled = vi.fn()
  const onSlow = vi.fn()
  const onGiveUp = vi.fn()
  const cancel = startGuidedLaunchSettlementWatch(key, {
    fetchGuidedLaunch,
    onSettled,
    onSlow,
    onGiveUp,
  })
  return { fetchGuidedLaunch, onSettled, onSlow, onGiveUp, cancel }
}

describe("startGuidedLaunchSettlementWatch", () => {
  it("reports settlement as soon as status moves off created, then stops", async () => {
    const w = setup(["created", "created", "paid"])
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(w.onSettled).toHaveBeenCalledWith({ status: "paid" })
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 5)
    expect(w.fetchGuidedLaunch).toHaveBeenCalledTimes(3)
  })

  it("keeps watching past the fast phase instead of giving up at ~30s", async () => {
    const statuses = Array(20).fill("created")
    statuses.push("paid")
    const w = setup(statuses)
    await vi.advanceTimersByTimeAsync(FAST_PHASE_MS + FAST_INTERVAL_MS)
    expect(w.onSlow).toHaveBeenCalledTimes(1)
    expect(w.onSettled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.onSettled).toHaveBeenCalledWith({ status: "paid" })
    expect(w.onGiveUp).not.toHaveBeenCalled()
  })

  it("treats a failed read as no news, not as a verdict", async () => {
    const w = setup([new Error("network"), "paid"])
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 2)
    expect(w.onSettled).toHaveBeenCalledTimes(1)
  })

  it("gives up once, after the limit, if it never settles", async () => {
    const w = setup(["created"])
    await vi.advanceTimersByTimeAsync(WATCH_LIMIT_MS + 10_000)
    expect(w.onGiveUp).toHaveBeenCalledTimes(1)
    expect(w.onSettled).not.toHaveBeenCalled()
    const calls = w.fetchGuidedLaunch.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.fetchGuidedLaunch.mock.calls.length).toBe(calls)
  })

  it("a second watch on the same account replaces the first", async () => {
    const first = setup(["created"], "acc-2")
    const second = setup(["created", "paid"], "acc-2")
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(first.fetchGuidedLaunch).not.toHaveBeenCalled()
    expect(second.onSettled).toHaveBeenCalledTimes(1)
  })

  it("cancel stops it", async () => {
    const w = setup(["paid"], "acc-3")
    w.cancel()
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(w.fetchGuidedLaunch).not.toHaveBeenCalled()
  })
})
