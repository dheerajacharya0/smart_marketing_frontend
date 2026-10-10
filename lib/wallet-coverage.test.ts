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
  it("is empty before the wallet loads", () => {
    expect(walletCoverage(undefined)).toEqual({ numbers: [] })
  })

  it("passes through the wallet's numbers", () => {
    const wallet = { ...base, numbers: [num({}), num({ phoneNumberId: "222" })] }
    expect(walletCoverage(wallet).numbers).toHaveLength(2)
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
