import { describe, expect, it } from "vitest"
import { guideForSignupError, NUMBER_CLAIMED_ELSEWHERE_GUIDE } from "./embedded-signup-errors"

describe("guideForSignupError", () => {
  it("maps Meta's already-registered code to the leftover-registration guide", () => {
    expect(guideForSignupError({ code: "2494064" })).toBe(NUMBER_CLAIMED_ELSEWHERE_GUIDE)
  })

  it("prefers the code over the message", () => {
    expect(guideForSignupError({ code: "4563015", message: "already registered" }).id).toBe("updateBusinessApp")
  })

  it("falls back to Meta's wording when there is no known code", () => {
    expect(guideForSignupError({ code: "999", message: "This phone number is already registered to a WhatsApp account." }).id).toBe(
      "numberClaimedElsewhere"
    )
    expect(guideForSignupError({ message: "Selected business lacks permission. Please try another." }).id).toBe("notAdmin")
  })

  it("keeps Meta's own words for anything unrecognised", () => {
    const guide = guideForSignupError({ code: "1", message: "Something odd" })
    expect(guide.id).toBe("unknown")
    expect(guide.cause).toBe("Something odd")
    expect(guideForSignupError({}).cause).toMatch(/facebook's side/i)
  })

  it("doesn't read an ordinary 'try again later' as rate limiting", () => {
    expect(guideForSignupError({ message: "Something went wrong. Please try again later." }).id).toBe("unknown")
  })
})
