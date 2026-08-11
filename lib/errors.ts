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
