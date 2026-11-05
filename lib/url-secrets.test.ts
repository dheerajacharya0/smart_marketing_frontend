import { describe, expect, it } from "vitest"
import { scrubUrl } from "./url-secrets"

describe("scrubUrl", () => {
  it("redacts token, code and state values", () => {
    expect(scrubUrl("https://converszio.com/reset-password?token=abc123")).toBe(
      "https://converszio.com/reset-password?token=[redacted]"
    )
    expect(scrubUrl("/invite?code=XYZ&utm=mail")).toBe("/invite?code=[redacted]&utm=mail")
    expect(scrubUrl("/dashboard/whatsapp/new?code=AQ_x&state=n0nce#top")).toBe(
      "/dashboard/whatsapp/new?code=[redacted]&state=[redacted]#top"
    )
  })

  it("is case-insensitive on the param name", () => {
    expect(scrubUrl("/verify-email?TOKEN=abc")).toBe("/verify-email?TOKEN=[redacted]")
  })

  it("leaves other params and paths alone", () => {
    const url = "/dashboard/templates?returnTo=%2Fdashboard%2Fchat&tokens=1&barcode=2"
    expect(scrubUrl(url)).toBe(url)
    expect(scrubUrl("/token/code/state")).toBe("/token/code/state")
  })
})
