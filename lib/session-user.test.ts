import { describe, expect, it } from "vitest"
import { toSessionUser } from "@/services/api"

describe("toSessionUser", () => {
  it("keeps only id, name and email", () => {
    const loginUser = {
      id: "u1",
      name: "Asha",
      email: "asha@example.com",
      accounts: [{ id: "a1", accessToken: "EAAB-secret", whatsappPin: "123456" }],
      password: "hash",
    }
    expect(toSessionUser(loginUser)).toEqual({
      id: "u1",
      name: "Asha",
      email: "asha@example.com",
    })
  })

  it("never serialises extra payload fields", () => {
    const raw = { id: "u1", email: "a@b.c", accounts: [{ accessToken: "EAAB-secret" }] }
    const stored = JSON.stringify(toSessionUser(raw))
    expect(stored).not.toContain("accounts")
    expect(stored).not.toContain("EAAB")
  })
})
