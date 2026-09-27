import { describe, expect, it } from "vitest"
import { describeShopifyError } from "./store-sync"

describe("describeShopifyError", () => {
  it("names both currencies when a store sells in another one", () => {
    expect(
      describeShopifyError("currency_mismatch", { storeCurrency: "USD", accountCurrency: "INR" })
    ).toMatch(/sells in USD but this account bills in INR/)
  })

  it("still explains a currency mismatch without the details", () => {
    expect(describeShopifyError("currency_mismatch")).toMatch(/different currency/)
  })

  it("tells the owner what to do for each known failure", () => {
    expect(describeShopifyError("store_taken")).toMatch(/another account/)
    expect(describeShopifyError("expired")).toMatch(/Start again/)
    expect(describeShopifyError("shopify_refused")).toMatch(/approve the request/)
    expect(describeShopifyError("invalid_request")).toMatch(/couldn't be verified/)
  })

  it("falls back for an unknown or missing code", () => {
    expect(describeShopifyError("something-new")).toMatch(/Try again/)
    expect(describeShopifyError(null)).toMatch(/Try again/)
  })
})
