import type { TemplateComponent } from "@/lib/whatsapp-template"

/**
 * What an approved template needs filled in before Meta will send it.
 *
 * Mirrors backend `src/common/template-spec.ts` — same reading of the template,
 * same wording for problems — so a form refuses exactly what the server would,
 * before the person reaches the end of a wizard. The backend stays the source
 * of truth and checks again on save.
 *
 * Every send form reads from this: campaigns (and repeating broadcasts), drip
 * steps, automation template actions and the inbox. Before it, each assumed
 * numbered body variables only, so a header variable, named variables or a
 * dynamic URL button was silently left out and Meta refused every message.
 */
export type TemplateHeaderSpec =
  | { kind: "none" }
  | { kind: "text"; token: string | null; named: boolean }
  | { kind: "media"; format: "image" | "video" | "document" }

export interface TemplateSpec {
  header: TemplateHeaderSpec
  /** Body variables in send order: numeric order, or first-seen for named. */
  body: { tokens: string[]; named: boolean; examples: string[] }
  /** URL buttons whose link ends in a variable, by index among the buttons. */
  urlButtons: { index: number; text: string; url: string }[]
  /** Parts this product can't fill; a template with any can't be sent here. */
  unsupported: string[]
  /** The header variable's example value, for placeholders. */
  headerExample: string
}

/** The values a form collects for a template, in template order. */
export interface TemplateInputValues {
  bodyParameters: string[]
  headerText: string
  buttonParameters: string[]
}

export const EMPTY_TEMPLATE_INPUTS: TemplateInputValues = {
  bodyParameters: [],
  headerText: "",
  buttonParameters: [],
}

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g

function tokensOf(text: string | undefined): string[] {
  if (!text) return []
  const seen: string[] = []
  for (const m of text.matchAll(TOKEN)) if (!seen.includes(m[1])) seen.push(m[1])
  return seen
}

const isNumeric = (t: string) => /^\d+$/.test(t)

const MEDIA: Record<string, "image" | "video" | "document"> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "document",
}

const STATIC_BUTTONS = new Set(["QUICK_REPLY", "PHONE_NUMBER", "FLOW", "VOICE_CALL"])

const BUTTON_NAMES: Record<string, string> = {
  COPY_CODE: "a coupon-code button",
  OTP: "a one-time-password button",
  CATALOG: "a catalog button",
  MPM: "a multi-product button",
  SPM: "a single-product button",
}

export function templateSpec(template: { components?: TemplateComponent[] } | null | undefined): TemplateSpec {
  const list = Array.isArray(template?.components) ? template!.components! : []
  const byType = (t: string) => list.find((c) => String(c?.type ?? "").toUpperCase() === t)
  const unsupported: string[] = []

  let header: TemplateHeaderSpec = { kind: "none" }
  let headerExample = ""
  const h = byType("HEADER")
  if (h) {
    const format = String(h.format ?? "TEXT").toUpperCase()
    if (format === "TEXT") {
      const tokens = tokensOf(h.text)
      if (tokens.length > 1) unsupported.push("more than one header variable")
      header = { kind: "text", token: tokens[0] ?? null, named: tokens.length > 0 && !isNumeric(tokens[0]) }
      headerExample = h.example?.header_text?.[0] ?? ""
    } else if (MEDIA[format]) {
      header = { kind: "media", format: MEDIA[format] }
    } else {
      unsupported.push(`a ${format.toLowerCase()} header`)
    }
  }

  const b = byType("BODY")
  const raw = tokensOf(b?.text)
  const named = raw.length > 0 && !raw.every(isNumeric)
  const tokens = named ? raw : [...raw].sort((x, y) => Number(x) - Number(y))
  const examples = named
    ? tokens.map((t) => b?.example?.body_text_named_params?.find((p) => p.param_name === t)?.example ?? "")
    : tokens.map((_, i) => b?.example?.body_text?.[0]?.[i] ?? "")

  const urlButtons: TemplateSpec["urlButtons"] = []
  const buttons = byType("BUTTONS")?.buttons
  if (Array.isArray(buttons)) {
    buttons.forEach((btn, index) => {
      const type = String(btn?.type ?? "").toUpperCase()
      if (type === "URL") {
        if (tokensOf(btn.url).length) {
          urlButtons.push({ index, text: String(btn.text ?? `Button ${index + 1}`), url: String(btn.url) })
        }
      } else if (!STATIC_BUTTONS.has(type)) {
        unsupported.push(BUTTON_NAMES[type] ?? `a ${type.toLowerCase()} button`)
      }
    })
  }

  for (const c of list) {
    const type = String(c?.type ?? "").toUpperCase()
    if (type === "CAROUSEL") unsupported.push("a carousel")
    if (type === "LIMITED_TIME_OFFER") unsupported.push("a limited-time offer")
  }

  return {
    header,
    headerExample,
    body: { tokens, named, examples },
    urlButtons,
    unsupported: [...new Set(unsupported)],
  }
}

/** True when the template takes no values at all. */
export function templateNeedsNoInputs(spec: TemplateSpec): boolean {
  return (
    !(spec.header.kind === "text" && spec.header.token) &&
    spec.body.tokens.length === 0 &&
    spec.urlButtons.length === 0
  )
}

/**
 * Resizes saved values to the template: keeps what lines up, pads with blanks,
 * drops the rest — switching templates must not carry one template's values
 * into another's slots past their count.
 */
export function fitTemplateInputs(spec: TemplateSpec, values: Partial<TemplateInputValues>): TemplateInputValues {
  const fit = (arr: string[] | undefined, n: number) => {
    const next = [...(arr ?? []).slice(0, n)]
    while (next.length < n) next.push("")
    return next
  }
  return {
    bodyParameters: fit(values.bodyParameters, spec.body.tokens.length),
    headerText: spec.header.kind === "text" && spec.header.token ? (values.headerText ?? "") : "",
    buttonParameters: fit(values.buttonParameters, spec.urlButtons.length),
  }
}

const label = (token: string) => `{{${token}}}`
const articled = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`)

/**
 * Everything wrong with these values for this template, in the server's words.
 * Empty means it will send. `headerMedia` is passed separately because each
 * form already owns a media picker for it.
 */
export function templateInputProblems(
  spec: TemplateSpec,
  values: TemplateInputValues,
  headerMedia?: { type?: string; link?: string; mediaId?: string } | null
): string[] {
  const problems: string[] = []
  if (spec.unsupported.length) {
    problems.push(
      `This template has ${spec.unsupported.join(", ")}, which can't be filled in here yet. Use a template without it.`
    )
  }
  if (spec.header.kind === "text" && spec.header.token && !values.headerText.trim()) {
    problems.push(`The template's header has a variable (${label(spec.header.token)}); give it a value.`)
  }
  if (spec.header.kind === "media" && !headerMedia?.link && !headerMedia?.mediaId) {
    problems.push(`The template's header is ${articled(spec.header.format)}; add one.`)
  }
  const blankBody = spec.body.tokens.findIndex((_, i) => !values.bodyParameters[i]?.trim())
  if (blankBody !== -1) problems.push(`Give ${label(spec.body.tokens[blankBody])} a value.`)
  const blankButton = spec.urlButtons.findIndex((_, i) => !values.buttonParameters[i]?.trim())
  if (blankButton !== -1) problems.push(`Give the "${spec.urlButtons[blankButton].text}" button's link a value.`)
  return problems
}

/**
 * The fields of a save payload for these values: only what the template takes,
 * so a template without a header variable never sends a stray `headerText`.
 */
export function templateInputPayload(spec: TemplateSpec, values: TemplateInputValues) {
  const fitted = fitTemplateInputs(spec, values)
  return {
    ...(fitted.bodyParameters.length ? { templateParameters: fitted.bodyParameters } : {}),
    ...(fitted.headerText ? { headerText: fitted.headerText } : {}),
    ...(fitted.buttonParameters.length ? { buttonParameters: fitted.buttonParameters } : {}),
  }
}

type Component = Record<string, unknown>

/**
 * The `components` for a direct send (the inbox, where values are final text):
 * header, body, buttons, named variables carrying their names. Undefined when
 * nothing needs filling. Mirrors the backend's buildComponentsFromSpec.
 */
export function buildDirectSendComponents(
  spec: TemplateSpec,
  values: TemplateInputValues,
  headerMedia?: { type: string; link?: string; mediaId?: string; filename?: string } | null
): Component[] | undefined {
  const components: Component[] = []
  if (spec.header.kind === "text" && spec.header.token) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "text",
          text: values.headerText,
          ...(spec.header.named ? { parameter_name: spec.header.token } : {}),
        },
      ],
    })
  } else if (spec.header.kind === "media" && headerMedia && (headerMedia.link || headerMedia.mediaId)) {
    const media = headerMedia.link ? { link: headerMedia.link } : { id: headerMedia.mediaId }
    components.push({
      type: "header",
      parameters: [
        {
          type: headerMedia.type,
          [headerMedia.type]: { ...media, ...(headerMedia.filename ? { filename: headerMedia.filename } : {}) },
        },
      ],
    })
  }
  if (spec.body.tokens.length) {
    components.push({
      type: "body",
      parameters: spec.body.tokens.map((token, i) => ({
        type: "text",
        text: values.bodyParameters[i] ?? "",
        ...(spec.body.named ? { parameter_name: token } : {}),
      })),
    })
  }
  spec.urlButtons.forEach((button, i) => {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: values.buttonParameters[i] ?? "" }],
    })
  })
  return components.length ? components : undefined
}

/** Body text with each variable replaced by its value, or left as-is when empty. */
export function fillBodyPreview(
  bodyText: string,
  spec: TemplateSpec,
  values: string[],
  render: (raw: string) => string = (raw) => raw
): string {
  return bodyText.replace(TOKEN, (match, token: string) => {
    const i = spec.body.tokens.indexOf(token)
    const raw = i === -1 ? "" : values[i]
    return raw ? render(raw) : match
  })
}

/** The values in the shape the template preview reads ({ header, body } by token). */
export function previewValues(
  spec: TemplateSpec,
  values: TemplateInputValues
): { header: Record<string, string>; body: Record<string, string> } {
  return {
    header:
      spec.header.kind === "text" && spec.header.token ? { [spec.header.token]: values.headerText } : {},
    body: Object.fromEntries(spec.body.tokens.map((t, i) => [t, values.bodyParameters[i] ?? ""])),
  }
}
