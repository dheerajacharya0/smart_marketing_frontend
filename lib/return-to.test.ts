import { describe, expect, it } from "vitest"
import { createTemplateHref, safeReturnTo } from "./return-to"

describe("safeReturnTo", () => {
  it("keeps a dashboard path", () => {
    expect(safeReturnTo("/dashboard/chat/new")).toBe("/dashboard/chat/new")
    expect(safeReturnTo("/dashboard/campaigns?new=1")).toBe("/dashboard/campaigns?new=1")
  })

  it("drops anything that could leave the site", () => {
    expect(safeReturnTo("https://evil.example")).toBeNull()
    expect(safeReturnTo("//evil.example/dashboard/")).toBeNull()
    expect(safeReturnTo("/dashboard/\\evil.example")).toBeNull()
    expect(safeReturnTo("/login")).toBeNull()
    expect(safeReturnTo("javascript:alert(1)")).toBeNull()
    expect(safeReturnTo("")).toBeNull()
    expect(safeReturnTo(null)).toBeNull()
  })
})

describe("createTemplateHref", () => {
  it("opens the editor and carries the way back", () => {
    expect(createTemplateHref("/dashboard/chat/new")).toBe(
      "/dashboard/templates?new=1&returnTo=%2Fdashboard%2Fchat%2Fnew",
    )
  })

  it("leaves out a return path it won't follow", () => {
    expect(createTemplateHref("https://evil.example")).toBe("/dashboard/templates?new=1")
    expect(createTemplateHref()).toBe("/dashboard/templates?new=1")
  })
})
