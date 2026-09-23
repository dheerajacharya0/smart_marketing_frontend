import { describe, expect, it } from "vitest"
import {
  OPT_IN_KEYWORDS,
  buildOptInLink,
  prefillGrantsConsent,
  toWaMeNumber,
} from "@/lib/opt-in-link"

describe("toWaMeNumber", () => {
  it.each([
    ["+91 90000 00000", "919000000000"],
    ["+1 (408) 767-6359", "14087676359"],
    ["919000000000", "919000000000"],
  ])("strips %s to digits", (input, expected) => {
    expect(toWaMeNumber(input)).toBe(expected)
  })
})

describe("buildOptInLink", () => {
  it("prefills the bare keyword", () => {
    expect(buildOptInLink("+91 90000 00000", "START")).toBe("https://wa.me/919000000000?text=START")
  })

  it("encodes a keyword containing a space", () => {
    expect(buildOptInLink("919000000000", "OPT IN")).toBe("https://wa.me/919000000000?text=OPT%20IN")
  })

  it("returns null when the number has no digits, rather than a link to nowhere", () => {
    expect(buildOptInLink("not a number", "START")).toBeNull()
  })

  it("returns null for an empty keyword", () => {
    expect(buildOptInLink("919000000000", "  ")).toBeNull()
  })
})

describe("prefillGrantsConsent", () => {
  // The backend matches a keyword only as the entire message, so these are the
  // prefills that actually record consent.
  it.each([...OPT_IN_KEYWORDS])("accepts the offered keyword %s", (keyword) => {
    expect(prefillGrantsConsent(keyword)).toBe(true)
  })

  it.each(["start", "Start", " START ", "start.", "subscribe", "opt-in", "resume"])(
    "accepts %s regardless of case, padding or trailing punctuation",
    (input) => {
      expect(prefillGrantsConsent(input)).toBe(true)
    },
  )

  it.each([
    "START - from the flyer",
    "please start",
    "Hi, I'd like updates",
    "START START",
    "",
  ])("rejects %s, which would silently collect nothing", (input) => {
    expect(prefillGrantsConsent(input)).toBe(false)
  })
})
