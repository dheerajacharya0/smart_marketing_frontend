/**
 * Money formatting, shared by every billing/revenue screen.
 *
 * Backend sends a decimal `balance`/`amount` in `currency` units plus an
 * integer-string `*Micros` (1 unit = 1,000,000 micros). We DISPLAY the decimal
 * and never compute prices client-side. Per-message costs are fractions of a
 * unit (an Indian marketing message is ~₹1.22), so sub-unit amounts get extra
 * precision.
 *
 * The currency ALWAYS comes from the response where one exists — never
 * hardcode a symbol and never assume one. The backend bills in INR today
 * (`BILLING_CURRENCY`), but an account carries its own `billingCurrency`, so
 * the only correct source is the `currency` field sitting next to the amount.
 * `FALLBACK_CURRENCY` exists for the rare spot with no such field to read at
 * all (there's no per-account currency endpoint outside billing responses) —
 * not as a default to lean on when one is available.
 */
/** 1 unit = 1,000,000 micros, matching the backend's money module. */
export const MICROS_PER_UNIT = BigInt(1000000)

export const FALLBACK_CURRENCY = "INR"

/** Format a decimal amount in its currency. Sub-unit values get more decimals. */
export function formatMoney(amount: number, currency = FALLBACK_CURRENCY): string {
  const abs = Math.abs(amount)
  // Show up to 6 decimals for sub-cent amounts (per-message costs), else 2.
  const maximumFractionDigits = abs > 0 && abs < 0.01 ? 6 : 2
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits,
    }).format(amount)
  } catch {
    // Unknown currency code — fall back to the code + fixed decimals.
    return `${amount.toFixed(maximumFractionDigits)} ${currency}`
  }
}

/**
 * Micros (integer string) → whole currency units, for display only.
 *
 * The backend sends micros as strings because a total in micros passes
 * Number.MAX_SAFE_INTEGER at around 9 billion units, and a silently rounded
 * total is a wrong price. Dividing as BigInt keeps that exact across every
 * figure a real total can reach; the final Number is a display value, so an
 * absurd magnitude still rounds — it just never becomes NaN.
 */
export function microsToUnits(micros: string | null | undefined): number {
  if (!micros) return 0
  try {
    const value = BigInt(micros)
    const whole = value / MICROS_PER_UNIT
    const fraction = value % MICROS_PER_UNIT
    return Number(whole) + Number(fraction) / Number(MICROS_PER_UNIT)
  } catch {
    // A malformed figure must not render as NaN next to a currency symbol.
    return 0
  }
}
