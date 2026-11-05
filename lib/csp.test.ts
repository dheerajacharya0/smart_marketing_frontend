import { describe, expect, it } from "vitest"
import { buildCsp, generateNonce, plaintextConnectOrigins } from "./csp"

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? ""

describe("generateNonce", () => {
  it("is base64 of 16 random bytes and differs per call", () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(a).not.toBe(b)
  })
})

describe("buildCsp", () => {
  const prod = buildCsp({ nonce: "abc123", isDev: false, plaintextOrigins: [] })

  it("trusts scripts by nonce + strict-dynamic, never unsafe-inline or unsafe-eval in prod", () => {
    const scriptSrc = directive(prod, "script-src")
    expect(scriptSrc).toContain("'nonce-abc123'")
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(scriptSrc).not.toContain("unsafe-inline")
    expect(scriptSrc).not.toContain("unsafe-eval")
  })

  it("allows eval only in dev", () => {
    const dev = buildCsp({ nonce: "n", isDev: true, plaintextOrigins: [] })
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'")
  })

  it("keeps the third-party origins the app needs", () => {
    expect(directive(prod, "script-src")).toContain("https://connect.facebook.net")
    expect(directive(prod, "frame-src")).toContain("https://checkout.razorpay.com")
    expect(directive(prod, "frame-src")).toContain("https://www.facebook.com")
    expect(prod).toContain("frame-ancestors 'none'")
    expect(prod).toContain("object-src 'none'")
  })

  it("appends plaintext origins to connect-src", () => {
    const csp = buildCsp({ nonce: "n", isDev: true, plaintextOrigins: ["http://localhost:3000"] })
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https: wss: http://localhost:3000")
  })
})

describe("plaintextConnectOrigins", () => {
  it("allows the http API and its socket port locally", () => {
    expect(plaintextConnectOrigins("http://localhost:3000", undefined, undefined)).toEqual([
      "http://localhost:3000",
      "ws://localhost:3002",
    ])
  })

  it("allows nothing for a TLS API", () => {
    expect(plaintextConnectOrigins("https://api.example.com", "3002", undefined)).toEqual([])
  })

  it("adds a plaintext ws override, ignores a TLS one", () => {
    expect(plaintextConnectOrigins("https://api.example.com", undefined, "http://10.0.0.5:4000")).toEqual([
      "ws://10.0.0.5:4000",
    ])
    expect(plaintextConnectOrigins("https://api.example.com", undefined, "https://ws.example.com")).toEqual([])
  })
})
