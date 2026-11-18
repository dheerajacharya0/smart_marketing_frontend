import { describe, expect, it } from "vitest"
import { USE_CASE_GUIDES, findUseCaseGuide } from "./use-case-guides"

const ALL_TEXT = (g: (typeof USE_CASE_GUIDES)[number]) =>
  [g.title, g.description, g.summary, g.template.body, g.template.whyCategory, g.watchOut, ...g.steps.flatMap((s) => [s.title, s.body]), ...g.faq.flatMap((f) => [f.q, f.a])].join("\n")

describe("USE_CASE_GUIDES", () => {
  it("has unique, URL-safe slugs that findUseCaseGuide resolves", () => {
    const slugs = USE_CASE_GUIDES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(findUseCaseGuide(s)?.slug).toBe(s)
    }
    expect(findUseCaseGuide("nope")).toBeUndefined()
  })

  it("keeps titles and descriptions within search snippet lengths", () => {
    for (const g of USE_CASE_GUIDES) {
      expect(g.metaTitle.length, g.metaTitle).toBeLessThanOrEqual(60)
      expect(g.description.length, g.description).toBeLessThanOrEqual(155)
    }
  })

  it("numbers template variables from {{1}} with no gaps", () => {
    for (const g of USE_CASE_GUIDES) {
      const nums = [...g.template.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
      expect(nums, g.slug).toEqual(nums.map((_, i) => i + 1))
    }
  })

  it("keeps promotional wording out of utility templates", () => {
    for (const g of USE_CASE_GUIDES.filter((x) => x.category === "utility")) {
      expect(g.template.body + g.template.buttons.join(" "), g.slug).not.toMatch(/save|off\b|discount|offer|deal|%/i)
    }
  })

  it("never claims Shopify sends messages by itself, and resolves every value", () => {
    for (const g of USE_CASE_GUIDES) {
      const text = ALL_TEXT(g)
      expect(text, g.slug).not.toMatch(/undefined|NaN|\$\{/)
      expect(text, g.slug).not.toMatch(/Shopify (sends|triggers|automatically)/i)
      expect(text, g.slug).not.toMatch(/₹\s?(1,?499|2,?999|5,?999)\b/)
    }
  })
})
