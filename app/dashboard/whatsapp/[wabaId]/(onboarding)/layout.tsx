import type React from "react"
import { OnboardingFrame } from "@/components/onboarding/onboarding-ui"

// Each step renders its own header, cards and footer. The layout used to wrap
// them in a Card of its own, which put every step's cards inside another card.
export default function WhatsAppIntegrationLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingFrame>{children}</OnboardingFrame>
}
