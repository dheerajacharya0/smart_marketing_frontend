import { describe, expect, it } from "vitest"
import { ApiError } from "@/services/api"
import { aiGenerateErrorMessage } from "./ai-generate-error"

const googleBody = (code: number, message: string) =>
  JSON.stringify({ error: { code, message, status: "X" } })

describe("aiGenerateErrorMessage", () => {
  it("turns a forwarded Gemini 503 body into plain text", () => {
    const err = new ApiError(
      googleBody(503, "This model is currently experiencing high demand."),
      502
    )
    const text = aiGenerateErrorMessage(err)
    expect(text).toMatch(/overloaded/)
    expect(text).not.toContain("{")
  })

  it("maps a forwarded 429 body to the rate-limit text", () => {
    expect(aiGenerateErrorMessage(new ApiError(googleBody(429, "quota"), 502))).toMatch(
      /rate-limited/
    )
  })

  it("unwraps the inner message for other upstream codes", () => {
    expect(
      aiGenerateErrorMessage(new ApiError(googleBody(400, "Bad prompt"), 502))
    ).toBe("Bad prompt")
  })

  it("passes a clean backend message through", () => {
    const msg = "Gemini is overloaded right now. Try again in a minute."
    expect(aiGenerateErrorMessage(new ApiError(msg, 503))).toBe(msg)
  })

  it("explains client and gateway timeouts", () => {
    expect(aiGenerateErrorMessage(new ApiError("Request timed out. Please try again.", 408))).toMatch(
      /too long/
    )
    expect(aiGenerateErrorMessage(new ApiError("Gemini timed out", 504))).toMatch(/too long/)
  })

  it("falls back when there is no message", () => {
    expect(aiGenerateErrorMessage(new ApiError("", 500))).toMatch(/Couldn't generate/)
    expect(aiGenerateErrorMessage(null)).toMatch(/Couldn't generate/)
  })
})
