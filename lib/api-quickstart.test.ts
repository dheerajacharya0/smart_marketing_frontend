import { describe, expect, it } from "vitest"
import { API_BASE_URL } from "@/config/api-config"
import { KEY_HEADER, KEY_PLACEHOLDER, buildQuickstart } from "@/lib/api-quickstart"

const ACCOUNT = "11111111-2222-3333-4444-555555555555"

describe("buildQuickstart", () => {
  it("omits the send examples when no number is registered, rather than inventing a phoneNumberId", () => {
    const ids = buildQuickstart({ accountId: ACCOUNT }).map((e) => e.id)
    expect(ids).toEqual(["conversion"])
  })

  it("offers send, template and sale once a number is known", () => {
    const ids = buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" }).map((e) => e.id)
    expect(ids).toEqual(["send", "send-template", "conversion"])
  })

  it("builds URLs from the shared endpoint builders, not a hardcoded base", () => {
    for (const example of buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" })) {
      expect(example.url.startsWith(API_BASE_URL)).toBe(true)
    }
  })

  it("puts the real accountId in every body, so a copied command runs as-is", () => {
    for (const example of buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" })) {
      expect(JSON.stringify(example.body)).toContain(ACCOUNT)
    }
  })

  it("sends the key as a header and never in the URL", () => {
    for (const example of buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" })) {
      expect(example.curl).toContain(`${KEY_HEADER}: ${KEY_PLACEHOLDER}`)
      expect(example.url).not.toContain(KEY_PLACEHOLDER)
    }
  })

  it("keeps each curl on one line, so it pastes into PowerShell as well as bash", () => {
    for (const example of buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" })) {
      expect(example.curl).not.toContain("\n")
      expect(example.curl).not.toContain("\\\n")
    }
  })

  it("uses the viewer's own number as the recipient when one is given", () => {
    const [send] = buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877", to: "+14155551234" })
    expect(send.body).toMatchObject({ to: "+14155551234" })
    expect(send.curl).toContain("+14155551234")
  })

  it("falls back to a placeholder recipient rather than an empty `to`", () => {
    const [send] = buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877", to: null })
    expect(send.body).toMatchObject({ to: expect.stringMatching(/^\+\d+$/) })
  })

  it("reports the sale value in major units, matching RecordConversionDto", () => {
    const sale = buildQuickstart({ accountId: ACCOUNT }).find((e) => e.id === "conversion")
    // 499.50, not 499500000 micros — the DTO converts at the boundary.
    expect(sale?.body).toMatchObject({ value: 499.5 })
  })

  it("carries an idempotency key on the sale, so a retried webhook can't double revenue", () => {
    const sale = buildQuickstart({ accountId: ACCOUNT }).find((e) => e.id === "conversion")
    expect(sale?.body).toMatchObject({ externalId: expect.any(String) })
  })

  it("escapes a single quote in an id so the shell can't break out of the argument", () => {
    const [sale] = buildQuickstart({ accountId: "acc'; rm -rf /" })
    // `'\''` is the whole of sh quote escaping: close, escape a literal quote,
    // reopen. The bare `'; rm` that would end the argument is nowhere in it.
    expect(sale.curl).toContain(`acc'\\''; rm -rf /`)
    expect(sale.curl.split(`'\\''`).join("")).not.toContain(`'; rm`)
  })

  it("declares a JSON content type only where there is a body", () => {
    for (const example of buildQuickstart({ accountId: ACCOUNT, phoneNumberId: "998877" })) {
      expect(example.curl.includes("Content-Type: application/json")).toBe(example.body !== undefined)
    }
  })
})
