import { describe, expect, it } from "vitest"
import { buildLlmsTxt } from "./llms-txt"
import { FAQ } from "./landing-faq"
import { META_RATES_INR } from "./savings"

describe("buildLlmsTxt", () => {
  const txt = buildLlmsTxt()

  it("follows the llms.txt shape: H1, then a blockquote summary", () => {
    const lines = txt.split("\n")
    expect(lines[0]).toBe("# Converszio")
    expect(lines.find((l) => l.startsWith(">"))).toMatch(/0% markup/)
  })

  it("carries the shared rates and every FAQ question", () => {
    expect(txt).toContain(`₹${META_RATES_INR.marketing}`)
    for (const { q } of FAQ) expect(txt).toContain(`### ${q}`)
  })

  it("links the public pages with absolute URLs", () => {
    expect(txt).toContain("(https://converszio.com/whatsapp-api-pricing-india)")
    expect(txt).not.toMatch(/\]\(\//)
  })

  it("keeps each FAQ answer on one line so it can't break the Markdown structure", () => {
    for (const { q, a } of FAQ) {
      expect(a).not.toMatch(/[\r\n]/)
      expect(q).not.toMatch(/[\r\n]/)
      expect(a.trimStart()).not.toMatch(/^(#|>|-|\*|\d+\.)\s/)
    }
  })

  it("has no Windows line endings or trailing spaces", () => {
    expect(txt).not.toContain("\r")
    expect(txt).not.toMatch(/[ \t]+\n/)
  })

  it("leaves nothing unresolved and publishes no plan prices", () => {
    expect(txt).not.toMatch(/undefined|NaN|\$\{/)
    expect(txt).not.toMatch(/₹\s?(1,?499|2,?999|5,?999)/)
  })
})
