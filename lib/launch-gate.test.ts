import { describe, expect, it } from "vitest"
import { gateToken, isPublicPath, safeEqual, safeNext } from "./launch-gate"

describe("isPublicPath", () => {
  it("lets the landing page and waitlist through", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/early-access")).toBe(true)
    expect(isPublicPath("/api/waitlist")).toBe(true)
    expect(isPublicPath("/privacy")).toBe(true)
  })

  // Meta's reviewers open these from the app settings, without the cookie.
  it("keeps the legal pages public", () => {
    expect(isPublicPath("/terms")).toBe(true)
    expect(isPublicPath("/data-deletion")).toBe(true)
  })

  it("keeps the product behind the gate", () => {
    expect(isPublicPath("/login")).toBe(false)
    expect(isPublicPath("/dashboard")).toBe(false)
    expect(isPublicPath("/early-access/x")).toBe(false)
  })
})

describe("gateToken", () => {
  it("is deterministic and never the password itself", async () => {
    const a = await gateToken("hunter2")
    expect(a).toBe(await gateToken("hunter2"))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain("hunter2")
  })

  it("changes when the password changes", async () => {
    expect(await gateToken("a")).not.toBe(await gateToken("b"))
  })
})

describe("safeEqual", () => {
  it("compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true)
    expect(safeEqual("abc", "abd")).toBe(false)
    expect(safeEqual("abc", "abcd")).toBe(false)
  })
})

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/dashboard/chat?x=1")).toBe("/dashboard/chat?x=1")
  })

  it("refuses anything that leaves the site", () => {
    expect(safeNext("https://evil.com")).toBe("/login")
    expect(safeNext("//evil.com")).toBe("/login")
    expect(safeNext("/\\evil.com")).toBe("/login")
    expect(safeNext(null)).toBe("/login")
  })

  it("doesn't loop back to the gate", () => {
    expect(safeNext("/early-access?next=/x")).toBe("/login")
  })
})
