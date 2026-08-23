/**
 * Recipient phone numbers — the client half of a rule the backend enforces.
 *
 * The backend validates every `to` / `waId` against the country's numbering
 * plan (src/common/phone-number.ts) and returns 400 before it ever calls Meta.
 * This file mirrors that rule with the *same* library, so the two agree on
 * every verdict. A disagreement is worse than no client check at all: a number
 * the form accepts and the API rejects reads as a broken app.
 *
 * Why a plan check and not a length check. `+91982863666` is nine national
 * digits where India's plan mandates ten. It passes E.164's outer bounds, it
 * passes `isPossible()` (India admits several national lengths across number
 * types), and Meta *accepts* it — HTTP 200, `message_status: "accepted"` —
 * then fails it on a webhook seconds later with 131026 "Message undeliverable".
 * The user was told it worked. Only `isValid()` catches it, so `isValid()` is
 * what we call; do not "simplify" this to a length check.
 */
import { env } from "@/lib/env"
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

/**
 * Shape rule, byte-for-byte the backend's: optional leading `+`, then digits.
 * No spaces, dashes, parens or brackets — the value is forwarded to Meta
 * verbatim, so anything it wouldn't accept has to die here.
 */
export const E164_SHAPE = /^\+?[1-9]\d{6,14}$/

/**
 * The client half of the backend's `PHONE_VALIDATION_DISABLED` escape hatch.
 *
 * Set `NEXT_PUBLIC_PHONE_VALIDATION_DISABLED=true` alongside it when stale
 * bundled metadata is refusing a carrier range that is genuinely live. Off, the
 * shape check still applies and Meta decides the rest. Refusing here while the
 * server has been told to allow it would leave the hatch shut.
 */
function validationDisabled(): boolean {
  return env.NEXT_PUBLIC_PHONE_VALIDATION_DISABLED === "true"
}

/**
 * The one predicate the rest of the app should ask. Both conditions must hold:
 * the shape above, and the number being valid for its own country's plan.
 *
 * The `+` is prepended when absent because the parser cannot read a country
 * code out of bare digits and returns undefined. No default region is ever
 * passed: every WhatsApp recipient carries its country code by definition, and
 * inferring a region from the user's locale would silently accept a local-format
 * number that fails at Meta.
 */
export function isValidRecipient(raw: string): boolean {
  if (!E164_SHAPE.test(raw)) return false
  if (validationDisabled()) return true
  const parsed = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw}`)
  return parsed?.isValid() ?? false
}

/** Digits only — what actually goes on the wire. See `toSubmittedRecipient`. */
export function digitsOf(raw: string): string {
  return raw.replace(/\D/g, "")
}

/**
 * The submitted form: bare digits, no `+`, no punctuation (`919828636666`).
 *
 * That is the form Meta echoes back as `wa_id`, and conversation threads are
 * keyed on it — submitting `+91…` for the same person can fragment the thread
 * into two.
 */
export function toSubmittedRecipient(raw: string): string {
  return digitsOf(raw)
}

export type RecipientProblem =
  /** Not digits-with-an-optional-plus, or outside E.164's 7–15 digits. */
  | "shape"
  /** Parsed to a country, but wrong for that country's numbering plan. */
  | "country"
  /** No country code we can resolve from the leading digits. */
  | "unknown-country"

export interface RecipientCheck {
  valid: boolean
  /** Digits only, ready to submit. */
  digits: string
  /** Resolved country, when the leading digits named one. */
  country?: CountryCode
  problem?: RecipientProblem
  /** Ready-to-render explanation, or undefined when valid. */
  message?: string
}

/**
 * Full verdict with the reason attached, for form fields and CSV rows.
 *
 * The three problems match the three messages the backend returns, so a user
 * who trips the client check and a user who somehow reaches the API read the
 * same explanation.
 */
export function checkRecipient(raw: string): RecipientCheck {
  const value = raw.trim()
  const digits = digitsOf(value)

  if (!E164_SHAPE.test(value)) {
    return {
      valid: false,
      digits,
      problem: "shape",
      message:
        "Enter the number in international format — country code then number, digits only, no spaces or symbols.",
    }
  }

  if (validationDisabled()) return { valid: true, digits }

  const parsed = parsePhoneNumberFromString(value.startsWith("+") ? value : `+${value}`)
  if (!parsed) {
    return {
      valid: false,
      digits,
      problem: "unknown-country",
      message: "That number doesn't start with a country code we recognise.",
    }
  }

  if (!parsed.isValid()) {
    const where = parsed.country ? countryName(parsed.country) : `+${parsed.countryCallingCode}`
    return {
      valid: false,
      digits,
      country: parsed.country,
      problem: "country",
      message: `Not a valid phone number for ${where} — check the number of digits.`,
    }
  }

  return { valid: true, digits, country: parsed.country }
}

/** `checkRecipient` reduced to the message, for fields that only render one. */
export function recipientErrorMessage(raw: string): string | null {
  const check = checkRecipient(raw)
  return check.valid ? null : (check.message ?? "Not a valid WhatsApp number.")
}

/**
 * Country code + national number for a stored recipient, so an existing value
 * can be loaded back into a picker-plus-field input.
 */
export function splitRecipient(raw: string): { country?: CountryCode; national: string } {
  const digits = digitsOf(raw)
  if (!digits) return { national: "" }
  const parsed = parsePhoneNumberFromString(`+${digits}`)
  if (!parsed?.country) return { national: digits }
  return { country: parsed.country, national: parsed.nationalNumber }
}

/** Pretty national formatting for the visible value; state keeps raw digits. */
export function formatNational(country: CountryCode, national: string): string {
  if (!national) return ""
  return new AsYouType(country).input(national)
}

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

/** "IN" → "India". Falls back to the raw code where Intl can't name it. */
export function countryName(code: CountryCode): string {
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * "IN" → 🇮🇳. Regional indicator symbols, so no flag assets and no list to
 * keep in step with the metadata. Renders as the two letters where a platform
 * has no flag glyph, which is a fine fallback.
 */
export function flagOf(code: CountryCode): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  )
}

export interface CountryOption {
  code: CountryCode
  name: string
  /** Calling code without the `+`, e.g. "91". */
  callingCode: string
}

let countryOptions: CountryOption[] | null = null

/** Every country the bundled metadata knows, A–Z by name. Built once. */
export function listCountries(): CountryOption[] {
  if (countryOptions) return countryOptions
  countryOptions = getCountries()
    .map((code) => ({ code, name: countryName(code), callingCode: getCountryCallingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return countryOptions
}

export function callingCodeOf(country: CountryCode): string {
  return getCountryCallingCode(country)
}

export type { CountryCode }
