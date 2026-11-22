import { describe, expect, it } from "vitest"
import {
  metaFiguresErrorText,
  needsReconnect,
  NEUTRAL,
  RECONNECT_EXPIRED,
  RECONNECT_NO_ACCESS,
} from "./meta-figures-error"

const RAW_100_33 =
  "Unsupported get request. Object with ID '399843203208973' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api"

const RAW = [
  RAW_100_33,
  "Error validating access token: Session has expired on Sunday, 22-Nov-26",
  "(#200) Requires business_management permission to manage the object",
  "(#100) Tried accessing nonexisting field (pricing_analytics)",
  "Invalid OAuth access token - Cannot parse access token",
  "Invalid parameter",
  "An unknown error has occurred.",
  "Please reduce the amount of data you're asking for, then retry your request",
]

describe("metaFiguresErrorText", () => {
  it.each(RAW)("replaces raw developer text with the neutral message: %s", (raw) => {
    expect(metaFiguresErrorText(raw, "meta")).toBe(NEUTRAL)
  })

  // The button shows only for needsReconnect(errorCode); the text must agree.
  it.each(RAW)("never says reconnect for errorCode 'meta': %s", (raw) => {
    expect(metaFiguresErrorText(raw, "meta")).not.toMatch(/Reconnect/)
  })

  it("names the right cause for each reconnect code", () => {
    expect(metaFiguresErrorText(RAW[1], "reconnect")).toBe(RECONNECT_EXPIRED)
    expect(metaFiguresErrorText(undefined, "reconnect")).toBe(RECONNECT_EXPIRED)
    expect(metaFiguresErrorText(RAW_100_33, "no_access")).toBe(RECONNECT_NO_ACCESS)
    expect(metaFiguresErrorText(undefined, "no_access")).toBe(RECONNECT_NO_ACCESS)
  })

  it("never adds 'try again later' itself", () => {
    for (const code of ["meta", "not_available", "not_enabled", undefined]) {
      expect(metaFiguresErrorText("(#100) Tried accessing nonexisting field", code)).toBe(NEUTRAL)
    }
  })

  // Real backend strings must pass through untouched, even when they share a
  // word with Meta's jargon ("access token", "permission").
  it.each([
    ["Meta won't share this WhatsApp account's figures with us. The Facebook login that connected it may no longer manage it. Reconnect WhatsApp to fix it.", "no_access"],
    ["Meta no longer accepts this connection. Reconnect WhatsApp to see Meta charges.", "reconnect"],
    ["We can't read Meta's figures for this WhatsApp account. Contact support and we'll fix it.", "meta"],
    ["Meta couldn't return its figures right now. Try again later.", "meta"],
    ["Template analytics isn’t turned on for this WhatsApp account yet.", "not_enabled"],
    ["Your Facebook access token expired. Reconnect WhatsApp to see Meta charges.", "reconnect"],
  ])("keeps the backend's own wording: %s", (ours, code) => {
    expect(metaFiguresErrorText(ours, code)).toBe(ours)
  })

  it("falls back when there is no message", () => {
    expect(metaFiguresErrorText(undefined)).toBe(NEUTRAL)
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
