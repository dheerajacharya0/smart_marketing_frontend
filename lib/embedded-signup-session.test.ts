import { describe, expect, it } from "vitest"
import {
  isFacebookOrigin,
  isNumberInUseCancel,
  parseEmbeddedSignupCancel,
  parseEmbeddedSignupMessage,
} from "./embedded-signup-session"

const finish = (data: Record<string, unknown>, event = "FINISH") =>
  JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event, data })

describe("isFacebookOrigin", () => {
  it("accepts facebook.com and its subdomains over https", () => {
    expect(isFacebookOrigin("https://www.facebook.com")).toBe(true)
    expect(isFacebookOrigin("https://web.facebook.com")).toBe(true)
    expect(isFacebookOrigin("https://facebook.com")).toBe(true)
  })

  it("rejects look-alikes, http and garbage", () => {
    expect(isFacebookOrigin("https://evilfacebook.com")).toBe(false)
    expect(isFacebookOrigin("https://facebook.com.evil.io")).toBe(false)
    expect(isFacebookOrigin("http://www.facebook.com")).toBe(false)
    expect(isFacebookOrigin("null")).toBe(false)
    expect(isFacebookOrigin("")).toBe(false)
  })
})

describe("parseEmbeddedSignupMessage", () => {
  const fb = "https://www.facebook.com"

  it("reads the picked WABA and phone number from a FINISH event", () => {
    expect(parseEmbeddedSignupMessage(fb, finish({ waba_id: "111", phone_number_id: "222" }))).toEqual({
      wabaId: "111",
      phoneNumberId: "222",
    })
  })

  it("accepts an already-parsed object payload", () => {
    const obj = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "111", phone_number_id: "222" } }
    expect(parseEmbeddedSignupMessage(fb, obj)).toEqual({ wabaId: "111", phoneNumberId: "222" })
  })

  it("keeps only the WABA for FINISH_ONLY_WABA", () => {
    expect(parseEmbeddedSignupMessage(fb, finish({ waba_id: "111" }, "FINISH_ONLY_WABA"))).toEqual({
      wabaId: "111",
    })
  })

  it("ignores CANCEL and ERROR events", () => {
    expect(parseEmbeddedSignupMessage(fb, finish({ waba_id: "111" }, "CANCEL"))).toBeNull()
    expect(parseEmbeddedSignupMessage(fb, finish({ waba_id: "111" }, "ERROR"))).toBeNull()
  })

  it("ignores the same payload from another origin", () => {
    expect(
      parseEmbeddedSignupMessage("https://evil.example", finish({ waba_id: "111", phone_number_id: "222" }))
    ).toBeNull()
  })

  it("ignores unrelated messages and malformed JSON", () => {
    expect(parseEmbeddedSignupMessage(fb, "not json")).toBeNull()
    expect(parseEmbeddedSignupMessage(fb, JSON.stringify({ type: "SOMETHING_ELSE" }))).toBeNull()
    expect(parseEmbeddedSignupMessage(fb, null)).toBeNull()
    expect(parseEmbeddedSignupMessage(fb, 42)).toBeNull()
  })

  it("drops non-numeric ids instead of forwarding them", () => {
    expect(
      parseEmbeddedSignupMessage(fb, finish({ waba_id: "../../x", phone_number_id: "222" }))
    ).toEqual({ phoneNumberId: "222" })
    expect(parseEmbeddedSignupMessage(fb, finish({ waba_id: 111, phone_number_id: {} }))).toBeNull()
  })

  it("reads the coexistence finish event", () => {
    expect(
      parseEmbeddedSignupMessage(fb, finish({ waba_id: "111", phone_number_id: "222" }, "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"))
    ).toEqual({ wabaId: "111", phoneNumberId: "222" })
  })
})

describe("parseEmbeddedSignupCancel", () => {
  const fb = "https://www.facebook.com"
  const inUse =
    "This phone number is already registered to a WhatsApp account. To use this number, disconnect it from the existing account."

  it("reads the error Meta showed before the customer left", () => {
    expect(
      parseEmbeddedSignupCancel(fb, finish({ error_message: inUse, error_id: "2494064", session_id: "s" }, "CANCEL"))
    ).toEqual({ errorMessage: inUse, errorId: "2494064" })
  })

  it("reads the abandoned step", () => {
    expect(parseEmbeddedSignupCancel(fb, finish({ current_step: "PHONE_NUMBER_SETUP" }, "CANCEL"))).toEqual({
      step: "PHONE_NUMBER_SETUP",
    })
  })

  it("ignores finish events and other origins", () => {
    expect(parseEmbeddedSignupCancel(fb, finish({ waba_id: "111" }))).toBeNull()
    expect(parseEmbeddedSignupCancel("https://evil.example", finish({ error_message: inUse }, "CANCEL"))).toBeNull()
  })
})

describe("isNumberInUseCancel", () => {
  it("spots Meta's number-in-use error only", () => {
    expect(
      isNumberInUseCancel({ errorMessage: "This phone number is already registered to a WhatsApp account." })
    ).toBe(true)
    expect(isNumberInUseCancel({ errorMessage: "Something else went wrong" })).toBe(false)
    expect(isNumberInUseCancel({ step: "PHONE_NUMBER_SETUP" })).toBe(false)
    expect(isNumberInUseCancel(null)).toBe(false)
  })
})
