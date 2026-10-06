import { describe, expect, it } from "vitest"
import { ONBOARDING_STEPS, onboardingStepIndex } from "./whatsapp-integration-stepper"

describe("onboardingStepIndex", () => {
  it("puts the Facebook page first", () => {
    expect(onboardingStepIndex("/dashboard/whatsapp/new")).toBe(0)
  })

  it("maps each step route to the step the user sees", () => {
    expect(onboardingStepIndex("/dashboard/whatsapp/acc-1/step-1")).toBe(1)
    expect(onboardingStepIndex("/dashboard/whatsapp/acc-1/step-2")).toBe(2)
    // Activation is part of the number step now; its route is only a fallback.
    expect(onboardingStepIndex("/dashboard/whatsapp/acc-1/step-3")).toBe(2)
    expect(onboardingStepIndex("/dashboard/whatsapp/acc-1/step-4")).toBe(ONBOARDING_STEPS.length - 1)
  })

  it("falls back to the first step for anything else", () => {
    expect(onboardingStepIndex("/dashboard/whatsapp/acc-1/step-9")).toBe(0)
    expect(onboardingStepIndex("")).toBe(0)
  })
})
