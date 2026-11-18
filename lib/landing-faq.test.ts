import { describe, expect, it } from "vitest"
import { FAQ, TRIAL_DAYS, faqJsonLd } from "./landing-faq"
import { META_RATES_INR } from "./savings"

describe("faqJsonLd", () => {
  it("emits one Question per FAQ item, answer text unchanged", () => {
    const ld = faqJsonLd()
    expect(ld["@type"]).toBe("FAQPage")
    expect(ld.mainEntity).toHaveLength(FAQ.length)
    ld.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(FAQ[i].q)
      expect(entry.acceptedAnswer.text).toBe(FAQ[i].a)
    })
  })

  it("resolves interpolated values instead of leaking placeholders", () => {
    const text = JSON.stringify(faqJsonLd())
    expect(text).toContain(`first ${TRIAL_DAYS} days are free`)
    expect(text).toContain(`₹${META_RATES_INR.marketing}`)
    expect(text).not.toMatch(/undefined|\$\{/)
  })
})
