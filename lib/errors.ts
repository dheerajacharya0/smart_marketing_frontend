/**
 * Error narrowing helpers (Phase 1).
 *
 * Catch clauses are typed `unknown` (the safe default). These narrow that back
 * to the fields the UI actually needs, so call sites never touch `any`.
 */
import { ApiError } from "@/services/api"

/** Human-readable message from any thrown value. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return fallback
}

/** HTTP status when the error came from the API layer, else undefined. */
export function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined
}

/**
 * The validation message for one field, so a 400 lands on the input that
 * caused it rather than in a toast the user has to map back themselves.
 *
 * Nest returns validation failures as `message: string[]`, each entry led by
 * the property name — `"to is not a valid phone number for country IN — check
 * the number of digits"`. Match on that leading name (word-boundary, so `to`
 * doesn't also match `token`). Other 4xx carry a plain string with no field
 * attached; those return undefined and belong in a toast.
 */
export function getFieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  const entries = error.details
  if (!entries?.length) return undefined
  const leadsWithField = new RegExp(`^${field}\\b`)
  return entries.find((entry) => leadsWithField.test(entry))
}
