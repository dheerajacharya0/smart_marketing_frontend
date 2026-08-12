/**
 * Money formatting for the prepaid wallet (Feature 3).
 *
 * Backend sends a decimal `balance`/`amount` in `currency` units plus an
 * integer-string `*Micros` (1 unit = 1,000,000 micros). We DISPLAY the decimal
 * and never compute prices client-side. Per-message costs are ~$0.01, so we show
 * extra precision for sub-cent amounts. Currency always comes from the backend —
 * never hardcode a symbol.
 */

/**
 * Below this (but above 0) a balance reads as "running low" — amber. At or below
 * 0 it's empty — red. Shared so the sidebar, the balance card, and the global
 * banner never disagree about when to warn.
 */
export const LOW_BALANCE_THRESHOLD = 1

/** Format a decimal amount in its currency. Sub-cent values get more decimals. */
export function formatMoney(amount: number, currency = "USD"): string {
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

/** A signed amount for a statement row, e.g. "+$5.00" / "-$0.0123". */
export function formatSignedMoney(amount: number, type: "credit" | "debit", currency = "USD"): string {
  const sign = type === "credit" ? "+" : "-"
  return `${sign}${formatMoney(Math.abs(amount), currency)}`
}
