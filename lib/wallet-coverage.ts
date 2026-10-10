import type { Wallet, WalletNumberBilling } from "@/services/api"

/**
 * This account's numbers, for listing which Meta credit line each bills
 * against. No markup any more (retired 2026-10-10), so there's no longer a
 * "what does the wallet pay for" question to answer per number — dropped the
 * `covers` field this used to compute (platform_fee / meta_cost_and_platform_fee
 * / mixed) once nothing read it.
 */
export function walletCoverage(wallet: Wallet | undefined): {
  numbers: WalletNumberBilling[]
} {
  return { numbers: wallet?.numbers ?? [] }
}

/** "+91 70147 97914 · dheeraj", or the bare id for a number Meta hasn't named. */
export function numberLabel(n: WalletNumberBilling): string {
  const number = n.displayPhoneNumber || n.phoneNumberId
  return n.verifiedName ? `${number} · ${n.verifiedName}` : number
}
