import { describe, expect, it } from "vitest"
import { addFallback, attributesWithoutFallback, NAME_KEY, resolveTokens } from "./message-tokens"

const contact = { name: "Asha", waId: "919876543210", attributes: { "Order ID": "A-17", city: "Pune", blank: " " } }

describe("resolveTokens", () => {
  // Spreadsheet headers keep their spaces as attribute keys.
  it("resolves attributes whose key has spaces", () => {
    expect(resolveTokens("Order {{attributes.Order ID}} for {{name}}", contact)).toBe("Order A-17 for Asha")
  })

  it("uses the fallback for a missing or blank value", () => {
    expect(resolveTokens("{{attributes.amount|0}} {{attributes.blank|n/a}} {{attributes.city|X}}", contact)).toBe(
      "0 n/a Pune",
    )
  })

  it("leaves an unresolvable token visible in the preview", () => {
    expect(resolveTokens("{{attributes.amount}}", contact)).toBe("{{attributes.amount}}")
    expect(resolveTokens("{{name}}", null)).toBe("{{name}}")
  })
})

describe("attributesWithoutFallback", () => {
  it("lists attributes that can come out empty", () => {
    expect(
      attributesWithoutFallback(["{{attributes.Order ID}} {{attributes.amount|0}}", "{{ attributes.Due Date }} {{name}}"]),
    ).toEqual(["Order ID", "Due Date", NAME_KEY])
  })

  it("skips tokens that already have a fallback, and waId", () => {
    expect(attributesWithoutFallback(["{{name|there}} {{waId}} {{attributes.x|-}}"])).toEqual([])
  })
})

describe("addFallback", () => {
  it("adds the fallback to every bare use of the key, and only those", () => {
    expect(
      addFallback(["{{attributes.Order ID}}", "x {{attributes.Order ID|old}} {{attributes.city}}"], "Order ID", "N/A"),
    ).toEqual(["{{attributes.Order ID|N/A}}", "x {{attributes.Order ID|old}} {{attributes.city}}"])
  })

  it("adds a fallback to {{name}}", () => {
    expect(addFallback(["Hi {{name}}", "{{ name|x }}"], NAME_KEY, "there")).toEqual(["Hi {{name|there}}", "{{ name|x }}"])
  })

  it("drops characters that would break the token, and ignores empty text", () => {
    expect(addFallback(["{{attributes.a}}"], "a", " {x|y} ")).toEqual(["{{attributes.a|xy}}"])
    expect(addFallback(["{{attributes.a}}"], "a", "  ")).toEqual(["{{attributes.a}}"])
  })
})
