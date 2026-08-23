import { afterEach, describe, expect, it, vi } from "vitest"
import {
  checkRecipient,
  digitsOf,
  formatNational,
  isValidRecipient,
  listCountries,
  recipientErrorMessage,
  splitRecipient,
  toSubmittedRecipient,
} from "./phone-number"

describe("isValidRecipient", () => {
  it("rejects the nine-digit Indian number Meta accepts and then fails", () => {
    // The whole reason this file exists: E.164 bounds pass, isPossible() passes,
    // Meta returns 200 "accepted", and a webhook fails it with 131026 later.
    expect(isValidRecipient("91982863666")).toBe(false)
  })

  it("accepts the same number with its tenth digit", () => {
    expect(isValidRecipient("919828636666")).toBe(true)
  })

  it("accepts a leading plus", () => {
    expect(isValidRecipient("+919828636666")).toBe(true)
  })

  it("rejects punctuation, which would be forwarded to Meta verbatim", () => {
    expect(isValidRecipient("+91 98286 36666")).toBe(false)
    expect(isValidRecipient("+91-98286-36666")).toBe(false)
    expect(isValidRecipient("(91) 9828636666")).toBe(false)
  })

  it("rejects a leading zero", () => {
    expect(isValidRecipient("0919828636666")).toBe(false)
  })

  it("rejects outside E.164's 7–15 digits", () => {
    expect(isValidRecipient("911111")).toBe(false)
    expect(isValidRecipient("9198286366661234")).toBe(false)
  })

  it("rejects an empty or non-numeric value", () => {
    expect(isValidRecipient("")).toBe(false)
    expect(isValidRecipient("not a number")).toBe(false)
  })

  it("accepts valid numbers in other countries", () => {
    expect(isValidRecipient("14155552671")).toBe(true) // US
    expect(isValidRecipient("447911123456")).toBe(true) // GB
    expect(isValidRecipient("5511987654321")).toBe(true) // BR
  })

  it("rejects a national-format number with no country code", () => {
    // No default region is passed, so bare national digits can never validate.
    expect(isValidRecipient("9828636666")).toBe(false)
  })
})

describe("checkRecipient", () => {
  it("names the country when the numbering plan is what failed", () => {
    const check = checkRecipient("91982863666")
    expect(check.valid).toBe(false)
    expect(check.problem).toBe("country")
    expect(check.country).toBe("IN")
    expect(check.message).toContain("India")
  })

  it("reports a shape failure separately from a plan failure", () => {
    expect(checkRecipient("+91 98286 36666").problem).toBe("shape")
    expect(checkRecipient("").problem).toBe("shape")
  })

  it("reports an unresolvable country code", () => {
    // +999 is unassigned, so nothing parses out of it.
    expect(checkRecipient("9991234567").problem).toBe("unknown-country")
  })

  it("carries submit-ready digits even when invalid, for the CSV fixer", () => {
    expect(checkRecipient("+91 98286 36666").digits).toBe("919828636666")
  })

  it("returns no message when valid", () => {
    const check = checkRecipient("919828636666")
    expect(check).toMatchObject({ valid: true, country: "IN", digits: "919828636666" })
    expect(check.message).toBeUndefined()
  })

  it("tolerates surrounding whitespace", () => {
    expect(checkRecipient("  919828636666 ").valid).toBe(true)
  })
})

describe("recipientErrorMessage", () => {
  it("is null for a valid number", () => {
    expect(recipientErrorMessage("919828636666")).toBeNull()
  })

  it("is a string for an invalid one", () => {
    expect(recipientErrorMessage("91982863666")).toMatch(/India/)
  })
})

describe("toSubmittedRecipient", () => {
  it("strips the plus and every separator", () => {
    expect(toSubmittedRecipient("+91 98286 36666")).toBe("919828636666")
    expect(toSubmittedRecipient("+1 (415) 555-2671")).toBe("14155552671")
  })

  it("leaves bare digits alone", () => {
    expect(toSubmittedRecipient("919828636666")).toBe("919828636666")
  })

  it("is what digitsOf does", () => {
    expect(toSubmittedRecipient("+91-98286-36666")).toBe(digitsOf("+91-98286-36666"))
  })
})

describe("splitRecipient", () => {
  it("splits a stored waId back into country and national number", () => {
    expect(splitRecipient("919828636666")).toEqual({ country: "IN", national: "9828636666" })
    expect(splitRecipient("+14155552671")).toEqual({ country: "US", national: "4155552671" })
  })

  it("returns the digits as-is when no country resolves", () => {
    expect(splitRecipient("9991234567")).toEqual({ national: "9991234567" })
  })

  it("handles an empty value", () => {
    expect(splitRecipient("")).toEqual({ national: "" })
  })
})

describe("formatNational", () => {
  it("formats for display without changing the digits behind it", () => {
    const shown = formatNational("IN", "9828636666")
    expect(digitsOf(shown)).toBe("9828636666")
    expect(shown).not.toBe("9828636666") // some separator was added
  })

  it("is empty for an empty national number", () => {
    expect(formatNational("IN", "")).toBe("")
  })
})

describe("NEXT_PUBLIC_PHONE_VALIDATION_DISABLED", () => {
  // The flag is read through lib/env, which parses once at module load, so the
  // module graph has to be rebuilt for each setting.
  async function loadWith(flag: string | undefined) {
    vi.resetModules()
    if (flag === undefined) delete process.env.NEXT_PUBLIC_PHONE_VALIDATION_DISABLED
    else process.env.NEXT_PUBLIC_PHONE_VALIDATION_DISABLED = flag
    return import("./phone-number")
  }

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PHONE_VALIDATION_DISABLED
    vi.resetModules()
  })

  it('falls back to the shape check alone when set to "true"', async () => {
    const phone = await loadWith("true")
    // Stale metadata refusing a real carrier range is the case this exists for.
    expect(phone.isValidRecipient("91982863666")).toBe(true)
    expect(phone.checkRecipient("91982863666").valid).toBe(true)
  })

  it("still enforces the shape while disabled — the value goes to Meta verbatim", async () => {
    const phone = await loadWith("true")
    expect(phone.isValidRecipient("+91 98286 36666")).toBe(false)
    expect(phone.isValidRecipient("0919828636666")).toBe(false)
    expect(phone.isValidRecipient("911111")).toBe(false)
  })

  it("validates against the numbering plan when unset or not exactly true", async () => {
    expect((await loadWith(undefined)).isValidRecipient("91982863666")).toBe(false)
    expect((await loadWith("")).isValidRecipient("91982863666")).toBe(false)
    expect((await loadWith("1")).isValidRecipient("91982863666")).toBe(false)
  })
})

describe("listCountries", () => {
  it("has India with calling code 91, sorted by name", () => {
    const countries = listCountries()
    expect(countries.find((c) => c.code === "IN")).toMatchObject({ name: "India", callingCode: "91" })
    const names = countries.map((c) => c.name)
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })
})
