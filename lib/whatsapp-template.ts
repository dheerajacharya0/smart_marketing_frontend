// Shared helpers for turning a Meta template definition (from GET /whatsapp/templates)
// into the {{n}} param inputs a send form needs, and back into the `components`
// array POST /whatsapp/send-template expects. Nothing here is per-template —
// it's all derived from each template's own `components`/`example` fields.

// Finds {{1}} / {{name}} style placeholders, deduped in first-seen order
export function extractTokens(text: string): string[] {
  const matches = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1])
  return [...new Set(matches)]
}

export function isPositional(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((t) => /^\d+$/.test(t))
}

export interface TemplateParamGroup {
  type: "header" | "body"
  tokens: string[]
  examples: string[]
}

// Returns one group per component (header/body) that actually has {{n}}
// placeholders — a template with none anywhere yields an empty array.
export function getTemplateParamGroups(template: any): TemplateParamGroup[] {
  const groups: TemplateParamGroup[] = []
  const components = template?.components || []

  const header = components.find((c: any) => c.type === "HEADER")
  if (header?.text) {
    const tokens = extractTokens(header.text)
    if (tokens.length) {
      const examples = header.example?.header_text || []
      groups.push({ type: "header", tokens, examples: tokens.map((_, i) => examples[i] || "") })
    }
  }

  const body = components.find((c: any) => c.type === "BODY")
  if (body?.text) {
    const rawTokens = extractTokens(body.text)
    if (rawTokens.length) {
      const positional = isPositional(rawTokens)
      const tokens = positional ? [...rawTokens].sort((a, b) => Number(a) - Number(b)) : rawTokens
      let examples: string[]
      if (positional) {
        const positionalExamples = body.example?.body_text?.[0] || []
        examples = tokens.map((_, i) => positionalExamples[i] || "")
      } else {
        const namedExamples = body.example?.body_text_named_params || []
        examples = tokens.map((tok) => namedExamples.find((p: any) => p.param_name === tok)?.example || "")
      }
      groups.push({ type: "body", tokens, examples })
    }
  }

  return groups
}

export type TemplateParamValues = Record<"header" | "body", Record<string, string>>

export function emptyTemplateParamValues(): TemplateParamValues {
  return { header: {}, body: {} }
}

export function allTemplateParamsFilled(groups: TemplateParamGroup[], values: TemplateParamValues): boolean {
  return groups.every((g) => g.tokens.every((tok) => !!values[g.type]?.[tok]?.trim()))
}

// Builds the `components` array for POST /whatsapp/send-template, or undefined
// when the template has no placeholders anywhere (Meta rejects an empty/absent
// components array the same way it rejects a wrong-count one, so omit it clean).
export function buildSendTemplateComponents(
  groups: TemplateParamGroup[],
  values: TemplateParamValues
): { type: string; parameters: { type: "text"; text: string }[] }[] | undefined {
  if (groups.length === 0) return undefined
  return groups.map((g) => ({
    type: g.type,
    parameters: g.tokens.map((tok) => ({ type: "text" as const, text: values[g.type]?.[tok] || "" })),
  }))
}
