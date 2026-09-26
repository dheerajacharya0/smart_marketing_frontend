import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  FAST_INTERVAL_MS,
  FAST_PHASE_MS,
  startCreditWatch,
  WATCH_LIMIT_MS,
} from "./wallet-credit-watch"

type W = { balanceMicros: string }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(balances: (string | Error)[], key = "acc-1") {
  let i = 0
  const fetchWallet = vi.fn(async (): Promise<W> => {
    const next = balances[Math.min(i++, balances.length - 1)]
    if (next instanceof Error) throw next
    return { balanceMicros: next }
  })
  const onCredited = vi.fn()
  const onSlow = vi.fn()
  const onGiveUp = vi.fn()
  const cancel = startCreditWatch(key, {
    fetchWallet,
    baselineMicros: "100",
    onCredited,
    onSlow,
    onGiveUp,
  })
  return { fetchWallet, onCredited, onSlow, onGiveUp, cancel }
}

describe("startCreditWatch", () => {
  it("reports the credit as soon as the balance moves, then stops", async () => {
    const w = setup(["100", "100", "600"])
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(w.onCredited).toHaveBeenCalledWith({ balanceMicros: "600" })
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 5)
    expect(w.fetchWallet).toHaveBeenCalledTimes(3)
  })

  it("keeps watching past the fast phase instead of giving up at ~30s", async () => {
    const balances = Array(20).fill("100")
    balances.push("600")
    const w = setup(balances)
    await vi.advanceTimersByTimeAsync(FAST_PHASE_MS + FAST_INTERVAL_MS)
    expect(w.onSlow).toHaveBeenCalledTimes(1)
    expect(w.onCredited).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.onCredited).toHaveBeenCalledWith({ balanceMicros: "600" })
    expect(w.onGiveUp).not.toHaveBeenCalled()
  })

  it("treats a failed read as no news, not as a verdict", async () => {
    const w = setup([new Error("network"), "600"])
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 2)
    expect(w.onCredited).toHaveBeenCalledTimes(1)
  })

  it("gives up once, after the limit, if the balance never moves", async () => {
    const w = setup(["100"])
    await vi.advanceTimersByTimeAsync(WATCH_LIMIT_MS + 10_000)
    expect(w.onGiveUp).toHaveBeenCalledTimes(1)
    expect(w.onCredited).not.toHaveBeenCalled()
    const calls = w.fetchWallet.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.fetchWallet.mock.calls.length).toBe(calls)
  })

  it("a second watch on the same account replaces the first", async () => {
    const first = setup(["100"], "acc-2")
    const second = setup(["100", "600"], "acc-2")
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(first.fetchWallet).not.toHaveBeenCalled()
    expect(second.onCredited).toHaveBeenCalledTimes(1)
  })

  it("cancel stops it", async () => {
    const w = setup(["600"], "acc-3")
    w.cancel()
    await vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS * 3)
    expect(w.fetchWallet).not.toHaveBeenCalled()
  })
})
