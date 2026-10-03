import { describe, expect, it } from "vitest"
import type { Wallet, WalletNumberBilling } from "@/services/api"
import { numberLabel, walletCoverage } from "./wallet-coverage"

const base: Wallet = {
  accountId: "acc1",
  currency: "INR",
  balanceMicros: "0",
  balance: 0,
  metaBilling: "customer",
  walletCovers: "platform_fee",
}

const num = (over: Partial<WalletNumberBilling>): WalletNumberBilling => ({
  phoneNumberId: "111",
  wabaId: "w1",
  displayPhoneNumber: "+91 70147 97914",
  verifiedName: "dheeraj",
  metaBilling: "customer",
  walletCovers: "platform_fee",
  ...over,
})

describe("walletCoverage", () => {
  it("is null before the wallet loads", () => {
    expect(walletCoverage(undefined)).toEqual({ covers: null, numbers: [] })
  })

  it("uses the account's mode when no numbers are sent", () => {
    expect(walletCoverage(base).covers).toBe("platform_fee")
  })

  it("uses the numbers' shared mode over the account's", () => {
    const wallet = {
      ...base,
      numbers: [num({ walletCovers: "meta_cost_and_platform_fee" })],
    }
    expect(walletCoverage(wallet).covers).toBe("meta_cost_and_platform_fee")
  })

  it("is mixed when numbers disagree", () => {
    const wallet = {
      ...base,
      numbers: [
        num({}),
        num({ phoneNumberId: "222", walletCovers: "meta_cost_and_platform_fee" }),
      ],
    }
    const result = walletCoverage(wallet)
    expect(result.covers).toBe("mixed")
    expect(result.numbers).toHaveLength(2)
  })
})

describe("numberLabel", () => {
  it("joins number and name", () => {
    expect(numberLabel(num({}))).toBe("+91 70147 97914 · dheeraj")
  })

  it("falls back to the id when Meta sent no number or name", () => {
    expect(numberLabel(num({ displayPhoneNumber: null, verifiedName: null }))).toBe("111")
  })
})
