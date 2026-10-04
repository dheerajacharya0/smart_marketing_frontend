import type { Contact } from "@/services/api"

/**
 * Personalization tokens in template variables — the same grammar the backend
 * resolves (campaigns.service.ts `TOKEN_PATTERN`):
 *
 *   {{name}}  {{waId}}  {{attributes.Order ID}}  {{attributes.amount|0}}
 *
 * An attribute key is the uploaded column's header as written, spaces
 * included. `|text` is the fallback used when a contact has no value — without
 * one, a contact missing the column is skipped at send, because Meta refuses
 * an empty parameter.
 */
export const TOKEN_PATTERN = /\{\{\s*(name|waId|attributes\.([^{}|]+?))\s*(?:\|([^{}]*))?\}\}/g

/** The live preview: tokens resolved against one sample contact. */
export function resolveTokens(value: string, contact: Pick<Contact, "name" | "waId" | "attributes"> | null): string {
  return value.replace(TOKEN_PATTERN, (match, token: string, attrKey?: string, fallback?: string) => {
    if (!contact) return match
    const raw =
      token === "name" ? contact.name : token === "waId" ? contact.waId : contact.attributes?.[(attrKey ?? "").trim()]
    if (raw?.trim()) return raw
    return fallback?.trim() ? fallback : match
  })
}

/** Stands for {{name}} in the coverage keys — matches the backend's NAME_KEY. */
export const NAME_KEY = "@name"

/**
 * What a contact can be missing: attribute keys, and NAME_KEY for {{name}},
 * each used without a fallback. ({{waId}} always has a value.)
 */
export function attributesWithoutFallback(values: string[]): string[] {
  const keys = new Set<string>()
  for (const value of values) {
    for (const m of value.matchAll(TOKEN_PATTERN)) {
      if (m[3] !== undefined) continue
      if (m[2]) keys.add(m[2].trim())
      else if (m[1] === "name") keys.add(NAME_KEY)
    }
  }
  return [...keys]
}

/** How a coverage key reads in a sentence. */
export const coverageLabel = (key: string) => (key === NAME_KEY ? "name" : key)

/** Gives every fallback-less use of `key` the fallback `text`. */
export function addFallback(values: string[], key: string, text: string): string[] {
  const clean = text.replace(/[{}|]/g, "").trim()
  if (!clean) return values
  return values.map((value) =>
    value.replace(TOKEN_PATTERN, (match, token: string, attrKey?: string, fallback?: string) => {
      if (fallback !== undefined) return match
      if (key === NAME_KEY && token === "name") return `{{name|${clean}}}`
      if (token.startsWith("attributes.") && attrKey?.trim() === key) return `{{attributes.${key}|${clean}}}`
      return match
    }),
  )
}
