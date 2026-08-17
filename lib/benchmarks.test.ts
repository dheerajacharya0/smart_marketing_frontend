import { describe, expect, it } from "vitest"
import {
  RATE_BENCHMARKS,
  CLICK_BENCHMARK,
  DELIVERY_BENCHMARK,
  FAILURE_BENCHMARK,
  READ_BENCHMARK,
  REPLY_BENCHMARK,
  rateHint,
  verdictTone,
} from "./benchmarks"

describe("delivery benchmark", () => {
  it("scores at the boundaries, not just inside them", () => {
    expect(DELIVERY_BENCHMARK.verdict(90)).toBe("good")
    expect(DELIVERY_BENCHMARK.verdict(89.9)).toBe("ok")
    expect(DELIVERY_BENCHMARK.verdict(70)).toBe("ok")
    expect(DELIVERY_BENCHMARK.verdict(69.9)).toBe("poor")
  })

  it("has advice for every scored verdict", () => {
    for (const verdict of ["good", "ok", "poor"] as const) {
      expect(DELIVERY_BENCHMARK.interpret(verdict)).toBeTruthy()
    }
  })
})

describe("read benchmark", () => {
  it("scores at the boundaries", () => {
    expect(READ_BENCHMARK.verdict(60)).toBe("good")
    expect(READ_BENCHMARK.verdict(59.9)).toBe("ok")
    expect(READ_BENCHMARK.verdict(40)).toBe("ok")
    expect(READ_BENCHMARK.verdict(39.9)).toBe("poor")
  })
})

describe("failure benchmark", () => {
  it("inverts direction — lower is better", () => {
    expect(FAILURE_BENCHMARK.verdict(0)).toBe("good")
    expect(FAILURE_BENCHMARK.verdict(1.9)).toBe("good")
    expect(FAILURE_BENCHMARK.verdict(2)).toBe("ok")
    expect(FAILURE_BENCHMARK.verdict(5)).toBe("poor")
    expect(FAILURE_BENCHMARK.verdict(100)).toBe("poor")
  })

  it("says nothing when the failure rate is healthy", () => {
    // "Your failure rate is fine" is noise; the panel filters on this.
    expect(FAILURE_BENCHMARK.interpret("good")).toBeUndefined()
    expect(FAILURE_BENCHMARK.interpret("ok")).toBeTruthy()
    expect(FAILURE_BENCHMARK.interpret("poor")).toBeTruthy()
  })
})

describe("reply benchmark", () => {
  it("is never scored — reply rate depends on whether the message asked for one", () => {
    expect(REPLY_BENCHMARK.verdict(0)).toBe("none")
    expect(REPLY_BENCHMARK.verdict(99)).toBe("none")
    expect(REPLY_BENCHMARK.interpret("none")).toBeUndefined()
    expect(REPLY_BENCHMARK.benchmark).toBeUndefined()
  })
})

describe("non-finite rates", () => {
  it("returns none rather than scoring NaN", () => {
    expect(DELIVERY_BENCHMARK.verdict(Number.NaN)).toBe("none")
    expect(READ_BENCHMARK.verdict(Number.NaN)).toBe("none")
    expect(FAILURE_BENCHMARK.verdict(Number.NaN)).toBe("none")
  })
})

describe("verdictTone", () => {
  it("treats a healthy failure rate as unremarkable, not a success", () => {
    expect(verdictTone(FAILURE_BENCHMARK, "good")).toBe("default")
    expect(verdictTone(FAILURE_BENCHMARK, "ok")).toBe("warning")
    expect(verdictTone(FAILURE_BENCHMARK, "poor")).toBe("danger")
  })

  it("uses success/warning for the ascending rates", () => {
    expect(verdictTone(DELIVERY_BENCHMARK, "good")).toBe("success")
    expect(verdictTone(DELIVERY_BENCHMARK, "ok")).toBe("warning")
    expect(verdictTone(DELIVERY_BENCHMARK, "poor")).toBe("default")
  })

  it("is neutral when there is no verdict", () => {
    expect(verdictTone(REPLY_BENCHMARK, "none")).toBe("default")
  })
})

describe("rateHint", () => {
  it("appends the benchmark when there is one", () => {
    expect(rateHint(READ_BENCHMARK, 62)).toBe("62% read rate · healthy is 60%+")
  })

  it("omits it for unscored rates", () => {
    expect(rateHint(REPLY_BENCHMARK, 4)).toBe("4% reply rate")
  })
})

describe("CLICK_BENCHMARK", () => {
  it("is unscored, like reply rate", () => {
    // A click rate depends on whether the message had a link worth clicking,
    // and a campaign that didn't track reports 0% while people may have
    // clicked a plain URL we can't see. Either way, scoring it is a guess.
    for (const rate of [0, 5, 50, 100]) {
      expect(CLICK_BENCHMARK.verdict(rate)).toBe("none")
      expect(CLICK_BENCHMARK.interpret("none")).toBeUndefined()
    }
    expect(verdictTone(CLICK_BENCHMARK, "none")).toBe("default")
  })

  it("is registered so the tiles and the panel read the same source", () => {
    expect(RATE_BENCHMARKS.click).toBe(CLICK_BENCHMARK)
  })
})
