import { describe, expect, it } from "vitest"
import {
  EMPTY_TEMPLATE_INPUTS,
  buildDirectSendComponents,
  fillBodyPreview,
  fitTemplateInputs,
  previewValues,
  templateInputPayload,
  templateInputProblems,
  templateNeedsNoInputs,
  templateSpec,
} from "./template-spec"
import { validateRule } from "./automation-rules"
import type { WhatsappTemplate } from "@/services/api"

// campain_101: the template behind campaign b1ecb08a (99 of 99 failed, 132000).
const HEADER_VAR = {
  components: [
    { type: "HEADER", format: "TEXT", text: "Hi {{1}},", example: { header_text: ["Mate"] } },
    { type: "BODY", text: "Quick question." },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "YES" }] },
  ],
}

const FULL = {
  components: [
    { type: "HEADER", format: "TEXT", text: "Order {{order}}" },
    {
      type: "BODY",
      text: "Hi {{first}}, it ships {{day}}",
      example: { body_text_named_params: [{ param_name: "first", example: "Asha" }, { param_name: "day", example: "Monday" }] },
    },
    {
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "Thanks" },
        { type: "URL", text: "Track", url: "https://shop.test/t/{{1}}" },
      ],
    },
  ],
}

describe("templateSpec", () => {
  it("finds the header variable the old count missed", () => {
    const spec = templateSpec(HEADER_VAR)
    expect(spec.header).toEqual({ kind: "text", token: "1", named: false })
    expect(spec.headerExample).toBe("Mate")
    expect(templateNeedsNoInputs(spec)).toBe(false)
  })

  it("reads named body variables with examples and dynamic URL buttons", () => {
    const spec = templateSpec(FULL)
    expect(spec.body).toEqual({ tokens: ["first", "day"], named: true, examples: ["Asha", "Monday"] })
    expect(spec.urlButtons).toEqual([{ index: 1, text: "Track", url: "https://shop.test/t/{{1}}" }])
  })

  it("orders numbered variables and reads positional examples", () => {
    const spec = templateSpec({
      components: [{ type: "BODY", text: "{{2}} {{1}}", example: { body_text: [["a", "b"]] } }],
    })
    expect(spec.body).toEqual({ tokens: ["1", "2"], named: false, examples: ["a", "b"] })
  })

  it("flags what can't be filled and handles media headers", () => {
    expect(
      templateSpec({ components: [{ type: "BUTTONS", buttons: [{ type: "COPY_CODE", text: "x" }] }] }).unsupported
    ).toEqual(["a coupon-code button"])
    expect(templateSpec({ components: [{ type: "HEADER", format: "VIDEO" }] }).header).toEqual({
      kind: "media",
      format: "video",
    })
    expect(templateNeedsNoInputs(templateSpec(null))).toBe(true)
  })
})

describe("templateInputProblems", () => {
  it("blocks the b1ecb08a campaign before it can be created", () => {
    expect(templateInputProblems(templateSpec(HEADER_VAR), EMPTY_TEMPLATE_INPUTS)).toEqual([
      "The template's header has a variable ({{1}}); give it a value.",
    ])
  })

  it("names the first missing body variable and button", () => {
    const spec = templateSpec(FULL)
    const values = fitTemplateInputs(spec, { headerText: "42", bodyParameters: ["Asha"] })
    expect(templateInputProblems(spec, values)).toEqual([
      "Give {{day}} a value.",
      'Give the "Track" button\'s link a value.',
    ])
  })

  it("requires the media a media header needs", () => {
    const spec = templateSpec({ components: [{ type: "HEADER", format: "IMAGE" }] })
    expect(templateInputProblems(spec, EMPTY_TEMPLATE_INPUTS)).toEqual([
      "The template's header is an image; add one.",
    ])
    expect(templateInputProblems(spec, EMPTY_TEMPLATE_INPUTS, { type: "image", link: "https://i" })).toEqual([])
  })

  it("refuses unsupported templates", () => {
    const spec = templateSpec({ components: [{ type: "CAROUSEL" }] })
    expect(templateInputProblems(spec, EMPTY_TEMPLATE_INPUTS)[0]).toContain("a carousel")
  })
})

describe("fitTemplateInputs and templateInputPayload", () => {
  it("sizes values to the template and drops what it doesn't take", () => {
    const spec = templateSpec(HEADER_VAR)
    expect(fitTemplateInputs(spec, { bodyParameters: ["stale"], buttonParameters: ["x"], headerText: "Asha" })).toEqual({
      bodyParameters: [],
      headerText: "Asha",
      buttonParameters: [],
    })
    expect(templateInputPayload(spec, { bodyParameters: ["stale"], headerText: "Asha", buttonParameters: [] })).toEqual({
      headerText: "Asha",
    })
  })

  it("pads missing slots", () => {
    const spec = templateSpec(FULL)
    expect(fitTemplateInputs(spec, {})).toEqual({ bodyParameters: ["", ""], headerText: "", buttonParameters: [""] })
  })
})

describe("buildDirectSendComponents", () => {
  it("sends header, named body and button parameters in Meta's order", () => {
    const spec = templateSpec(FULL)
    expect(
      buildDirectSendComponents(spec, { headerText: "42", bodyParameters: ["Asha", "Monday"], buttonParameters: ["abc"] })
    ).toEqual([
      { type: "header", parameters: [{ type: "text", text: "42", parameter_name: "order" }] },
      {
        type: "body",
        parameters: [
          { type: "text", text: "Asha", parameter_name: "first" },
          { type: "text", text: "Monday", parameter_name: "day" },
        ],
      },
      { type: "button", sub_type: "url", index: "1", parameters: [{ type: "text", text: "abc" }] },
    ])
  })

  it("sends a media header and nothing for a template without inputs", () => {
    const spec = templateSpec({ components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hi" }] })
    expect(buildDirectSendComponents(spec, EMPTY_TEMPLATE_INPUTS, { type: "image", mediaId: "m1" })).toEqual([
      { type: "header", parameters: [{ type: "image", image: { id: "m1" } }] },
    ])
    expect(buildDirectSendComponents(templateSpec({ components: [{ type: "BODY", text: "Hi" }] }), EMPTY_TEMPLATE_INPUTS)).toBeUndefined()
  })
})

describe("previews", () => {
  it("fills named and numbered variables, leaving empty ones visible", () => {
    const spec = templateSpec(FULL)
    expect(fillBodyPreview("Hi {{first}}, it ships {{day}}", spec, ["Asha", ""])).toBe("Hi Asha, it ships {{day}}")
    expect(previewValues(spec, { headerText: "42", bodyParameters: ["Asha", "Mon"], buttonParameters: [] })).toEqual({
      header: { order: "42" },
      body: { first: "Asha", day: "Mon" },
    })
  })
})

describe("automation template actions", () => {
  const rule = (action: object) => ({
    name: "r",
    phoneNumberId: "pn",
    trigger: { type: "new_contact" as const },
    actions: [action as never],
  })
  const templates = [{ name: "campain_101", language: "en_US", ...HEADER_VAR }] as unknown as WhatsappTemplate[]

  it("flags a template action missing its header value once templates are known", () => {
    const action = { type: "send_template", templateName: "campain_101", templateLanguage: "en_US" }
    expect(validateRule(rule(action)).filter((i) => i.field === "actions")).toEqual([])
    expect(validateRule(rule(action), templates)).toContainEqual({
      field: "actions",
      index: 0,
      message: "The template's header has a variable ({{1}}); give it a value.",
    })
    expect(
      validateRule(rule({ ...action, headerText: "{{name}}" }), templates).filter((i) => i.field === "actions")
    ).toEqual([])
  })
})
