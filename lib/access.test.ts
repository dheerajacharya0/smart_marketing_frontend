import { describe, expect, it } from "vitest"
import { canOpen, roleAllows, routeAccess } from "./access"

describe("routeAccess", () => {
  it("leaves everyday work open to every member", () => {
    for (const path of ["/dashboard", "/dashboard/chat", "/dashboard/chat/abc", "/dashboard/contacts", "/dashboard/campaigns/1", "/dashboard/templates"]) {
      expect(routeAccess(path)).toBe("member")
    }
  })

  it("keeps money, integrations and setup to managers", () => {
    for (const path of ["/dashboard/billing", "/dashboard/api-usage", "/dashboard/automation", "/dashboard/revenue", "/dashboard/whatsapp/new"]) {
      expect(routeAccess(path)).toBe("manager")
    }
  })

  it("lets members into a WABA's templates under the setup prefix", () => {
    expect(routeAccess("/dashboard/whatsapp/acc-1/templates")).toBe("member")
    expect(routeAccess("/dashboard/whatsapp/acc-1/step-2")).toBe("manager")
  })

  it("matches whole segments, not string prefixes", () => {
    expect(routeAccess("/dashboard/billingx")).toBe("member")
  })

  it("keeps linked Facebook users to the owner", () => {
    expect(routeAccess("/dashboard/users")).toBe("owner")
  })
})

describe("roleAllows / canOpen", () => {
  it("gives the owner everything", () => {
    expect(canOpen("owner", "/dashboard/users")).toBe(true)
    expect(canOpen("owner", "/dashboard/billing")).toBe(true)
  })

  it("gives an admin everything but owner-only", () => {
    expect(canOpen("admin", "/dashboard/billing")).toBe(true)
    expect(canOpen("admin", "/dashboard/users")).toBe(false)
  })

  it("gives an agent only member-level routes", () => {
    expect(canOpen("agent", "/dashboard/chat")).toBe(true)
    expect(canOpen("agent", "/dashboard/whatsapp/acc-1/templates")).toBe(true)
    expect(canOpen("agent", "/dashboard/billing")).toBe(false)
    expect(roleAllows("agent", "manager")).toBe(false)
  })
})
