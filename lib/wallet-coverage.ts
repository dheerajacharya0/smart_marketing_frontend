import type { Wallet, WalletNumberBilling } from "@/services/api"

export type WalletCovers = "platform_fee" | "meta_cost_and_platform_fee"

/**
 * What the wallet pays for, now that each number has its own Meta billing
 * mode. `mixed` when the account's numbers disagree — then no single sentence
 * is true and the card lists them. Falls back to the account's mode when the
 * backend sends no numbers (none connected yet, or an older backend).
 */
export function walletCoverage(wallet: Wallet | undefined): {
  covers: WalletCovers | "mixed" | null
  numbers: WalletNumberBilling[]
} {
  const numbers = wallet?.numbers ?? []
  if (numbers.length === 0) return { covers: wallet?.walletCovers ?? null, numbers }
  const first = numbers[0].walletCovers
  const covers = numbers.every((n) => n.walletCovers === first) ? first : "mixed"
  return { covers, numbers }
}

/** "+91 70147 97914 · dheeraj", or the bare id for a number Meta hasn't named. */
export function numberLabel(n: WalletNumberBilling): string {
  const number = n.displayPhoneNumber || n.phoneNumberId
  return n.verifiedName ? `${number} · ${n.verifiedName}` : number
}
