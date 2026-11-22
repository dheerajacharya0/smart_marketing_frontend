import { describe, expect, it } from "vitest"
import { metaFiguresErrorText, needsReconnect } from "./meta-figures-error"

describe("metaFiguresErrorText", () => {
  it("hides Meta's raw Graph API message", () => {
    const raw =
      "Unsupported get request. Object with ID '399843203208973' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api"
    const text = metaFiguresErrorText(raw)
    expect(text).not.toMatch(/Object with ID|graph-api/)
    expect(text).toMatch(/Meta couldn't return/)
  })

  it("keeps the backend's own wording", () => {
    const ours = "Meta won't share this WhatsApp account's figures with us. Reconnect WhatsApp to fix it."
    expect(metaFiguresErrorText(ours)).toBe(ours)
  })

  it("falls back when there is no message", () => {
    expect(metaFiguresErrorText(undefined)).toMatch(/Meta couldn't return/)
  })
})

describe("needsReconnect", () => {
  it("is true for an expired token and for lost access to the WABA", () => {
    expect(needsReconnect("reconnect")).toBe(true)
    expect(needsReconnect("no_access")).toBe(true)
  })
  it("is false for anything else", () => {
    expect(needsReconnect("meta")).toBe(false)
    expect(needsReconnect(undefined)).toBe(false)
  })
})
