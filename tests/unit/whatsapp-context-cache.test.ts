import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getAvailableWhatsappContexts,
  getFacebookAccountsCached,
  invalidateAccountCaches,
} from "@/services/api"

/**
 * Resolving the WhatsApp context is on the critical path of every dashboard
 * page, and it costs two sequential round trips. These tests pin the caching
 * that keeps a route change from paying that twice — and, just as important,
 * pin the invalidation, because a context cache that outlives the fact it
 * caches shows the user "no account connected" right after they connected one.
 */

interface FetchCall {
  url: string
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const ACCOUNTS = [{ id: "acc-1", type: "facebook" }]
const NUMBERS = [
  {
    wabaId: "waba-1",
    phoneNumberId: "pn-1",
    displayPhoneNumber: "+91 90000 00000",
    verifiedName: "Acme",
    status: "registered",
  },
]

let calls: FetchCall[]

beforeEach(() => {
  calls = []
  invalidateAccountCaches()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push({ url: String(url) })
      if (String(url).includes("/phone-numbers") || String(url).includes("phone")) {
        return jsonResponse(NUMBERS)
      }
      return jsonResponse(ACCOUNTS)
    }),
  )
})

afterEach(() => {
  invalidateAccountCaches()
  vi.unstubAllGlobals()
})

const accountsCalls = () => calls.filter((c) => !c.url.includes("phone")).length

describe("whatsapp context caching", () => {
  it("resolves the contexts on a cold cache", async () => {
    const contexts = await getAvailableWhatsappContexts()

    expect(contexts).toEqual([
      {
        accountId: "acc-1",
        wabaId: "waba-1",
        phoneNumberId: "pn-1",
        displayPhoneNumber: "+91 90000 00000",
        verifiedName: "Acme",
      },
    ])
  })

  it("serves a second resolve from cache instead of re-walking the chain", async () => {
    await getAvailableWhatsappContexts()
    const afterFirst = calls.length
    expect(afterFirst).toBeGreaterThan(1) // accounts, then that account's numbers

    await getAvailableWhatsappContexts()

    expect(calls.length).toBe(afterFirst)
  })

  it("dedupes concurrent callers onto one in-flight resolve", async () => {
    // The sidebar, the wallet banner and the page all mount together; each used
    // to fire the whole chain independently.
    const [a, b, c] = await Promise.all([
      getAvailableWhatsappContexts(),
      getAvailableWhatsappContexts(),
      getAvailableWhatsappContexts(),
    ])

    expect(a).toEqual(b)
    expect(b).toEqual(c)
    expect(accountsCalls()).toBe(1)
  })

  it("shares the account lookup with getFacebookAccountsCached", async () => {
    await getAvailableWhatsappContexts()
    const before = accountsCalls()

    await getFacebookAccountsCached()

    expect(accountsCalls()).toBe(before)
  })

  it("refetches after invalidateAccountCaches", async () => {
    await getAvailableWhatsappContexts()
    const before = calls.length

    invalidateAccountCaches()
    await getAvailableWhatsappContexts()

    expect(calls.length).toBeGreaterThan(before)
  })

  it("does not cache a failure", async () => {
    // One transient network error must not leave the whole dashboard reporting
    // "no account connected" for the rest of the TTL.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push({ url: String(url) })
        if (calls.length === 1) throw new Error("network down")
        if (String(url).includes("phone")) return jsonResponse(NUMBERS)
        return jsonResponse(ACCOUNTS)
      }),
    )

    await expect(getAvailableWhatsappContexts()).rejects.toThrow()

    const contexts = await getAvailableWhatsappContexts()
    expect(contexts).toHaveLength(1)
  })
})
