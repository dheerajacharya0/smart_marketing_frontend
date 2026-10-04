import { describe, expect, it } from "vitest"
import { routeAfterNumberSwitch } from "./number-switch-route"

describe("routeAfterNumberSwitch", () => {
  it("sends the templates screen back to the entry page, which resolves the new number", () => {
    expect(routeAfterNumberSwitch("/dashboard/whatsapp/acc-1/templates")).toBe("/dashboard/templates")
  })

  it("sends an open chat back to the list", () => {
    expect(routeAfterNumberSwitch("/dashboard/chat/conv-1")).toBe("/dashboard/chat")
  })

  it("sends an open WhatsApp form back to the list, which shows the new number's WABA", () => {
    expect(routeAfterNumberSwitch("/dashboard/whatsapp-flows/flow-1")).toBe("/dashboard/whatsapp-flows")
  })

  it("sends an open campaign, drip or chatbot flow back to its list", () => {
    expect(routeAfterNumberSwitch("/dashboard/campaigns/c-1")).toBe("/dashboard/campaigns")
    expect(routeAfterNumberSwitch("/dashboard/drips/d-1/edit")).toBe("/dashboard/drips")
    expect(routeAfterNumberSwitch("/dashboard/flows/f-1/sessions")).toBe("/dashboard/flows")
  })

  it("lets a new-item page re-mount onto the new number", () => {
    expect(routeAfterNumberSwitch("/dashboard/drips/new")).toBeNull()
    expect(routeAfterNumberSwitch("/dashboard/flows/new")).toBeNull()
  })

  it("leaves pages that re-read the active number alone", () => {
    expect(routeAfterNumberSwitch("/dashboard/templates")).toBeNull()
    expect(routeAfterNumberSwitch("/dashboard/chat")).toBeNull()
    expect(routeAfterNumberSwitch("/dashboard/chat/new")).toBeNull()
    expect(routeAfterNumberSwitch("/dashboard/campaigns")).toBeNull()
    expect(routeAfterNumberSwitch("/dashboard/whatsapp/acc-1/step-2")).toBeNull()
    expect(routeAfterNumberSwitch(null)).toBeNull()
  })
})
