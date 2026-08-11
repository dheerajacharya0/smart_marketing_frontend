import { describe, it, expect } from "vitest"
import {
  extractTokens,
  isPositional,
  getTemplateParamGroups,
  buildSendTemplateComponents,
  allTemplateParamsFilled,
  type TemplateParamGroup,
} from "./whatsapp-template"

describe("extractTokens", () => {
  it("finds positional and named placeholders, deduped in order", () => {
    expect(extractTokens("Hi {{1}}, order {{2}} for {{1}}")).toEqual(["1", "2"])
    expect(extractTokens("Hi {{name}} in {{city}}")).toEqual(["name", "city"])
  })
  it("returns empty for text with no placeholders", () => {
    expect(extractTokens("no vars here")).toEqual([])
  })
})

describe("isPositional", () => {
  it("is true only when every token is a number", () => {
    expect(isPositional(["1", "2"])).toBe(true)
    expect(isPositional(["1", "name"])).toBe(false)
    expect(isPositional([])).toBe(false)
  })
})

describe("getTemplateParamGroups", () => {
  it("returns a body group with positional examples", () => {
    const groups = getTemplateParamGroups({
      components: [
        {
          type: "BODY",
          text: "Hi {{1}}, your order {{2}} is ready",
          example: { body_text: [["Ada", "#42"]] },
        },
      ],
    })
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe("body")
    expect(groups[0].tokens).toEqual(["1", "2"])
    expect(groups[0].examples).toEqual(["Ada", "#42"])
  })

  it("returns empty when no component has placeholders", () => {
    expect(getTemplateParamGroups({ components: [{ type: "BODY", text: "static" }] })).toEqual([])
    expect(getTemplateParamGroups({ components: [] })).toEqual([])
    expect(getTemplateParamGroups({})).toEqual([])
  })
})

describe("buildSendTemplateComponents", () => {
  const groups: TemplateParamGroup[] = [{ type: "body", tokens: ["1", "2"], examples: ["", ""] }]

  it("maps filled values into Meta component params", () => {
    const result = buildSendTemplateComponents(groups, { header: {}, body: { "1": "Ada", "2": "#42" } })
    expect(result).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Ada" }, { type: "text", text: "#42" }] },
    ])
  })

  it("returns undefined when there are no groups", () => {
    expect(buildSendTemplateComponents([], { header: {}, body: {} })).toBeUndefined()
  })
})

describe("allTemplateParamsFilled", () => {
  const groups: TemplateParamGroup[] = [{ type: "body", tokens: ["1"], examples: [""] }]
  it("is false when a token is blank/whitespace, true when filled", () => {
    expect(allTemplateParamsFilled(groups, { header: {}, body: { "1": "" } })).toBe(false)
    expect(allTemplateParamsFilled(groups, { header: {}, body: { "1": "   " } })).toBe(false)
    expect(allTemplateParamsFilled(groups, { header: {}, body: { "1": "x" } })).toBe(true)
  })
})
