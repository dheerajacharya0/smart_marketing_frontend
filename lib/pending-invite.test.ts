// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { clearPendingInvite, readPendingInvite, sameEmail, savePendingInvite } from "./pending-invite"

const invite = { code: "tok-123", id: "inv-1", email: "new@corp.com", teamName: "Acme", hasAccount: false }

describe("pending invite", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("round-trips a saved invite", () => {
    savePendingInvite(invite, 1000)
    expect(readPendingInvite(2000)).toEqual({ ...invite, savedAt: 1000 })
  })

  it("forgets an invite older than the seven days it could last", () => {
    savePendingInvite(invite, 0)
    expect(readPendingInvite(8 * 24 * 60 * 60 * 1000)).toBeNull()
    expect(window.localStorage.getItem("pendingTeamInvite")).toBeNull()
  })

  it("drops a malformed entry instead of throwing", () => {
    window.localStorage.setItem("pendingTeamInvite", "{not json")
    expect(readPendingInvite()).toBeNull()
    window.localStorage.setItem("pendingTeamInvite", JSON.stringify({ email: "x@y.com" }))
    expect(readPendingInvite()).toBeNull()
  })

  it("clears", () => {
    savePendingInvite(invite)
    clearPendingInvite()
    expect(readPendingInvite()).toBeNull()
  })
})

describe("sameEmail", () => {
  it("ignores case and surrounding space", () => {
    expect(sameEmail(" New@Corp.com ", "new@corp.com")).toBe(true)
    expect(sameEmail("a@corp.com", "b@corp.com")).toBe(false)
    expect(sameEmail(null, "a@corp.com")).toBe(false)
  })
})
