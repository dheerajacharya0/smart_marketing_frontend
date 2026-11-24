// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"

vi.mock("@/services/api", () => ({ confirmMetaPayment: vi.fn() }))

import { CampaignDeferredBanner } from "./campaign-deferred-banner"
import { CampaignStatusBadge } from "./campaign-badges"
import { MetaBillingHoldBanner } from "@/components/meta-billing-hold-banner"

function wrap(node: ReactNode) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, node)
}

afterEach(cleanup)

describe("Meta billing hold", () => {
  const held = { status: "running" as const, deferredReason: "meta_payment" as const }

  it("explains the hold, links to Meta billing and offers the fix button", () => {
    render(wrap(<CampaignDeferredBanner campaign={held} accountId="acc-1" />))
    expect(screen.getByText(/Meta refused to bill/)).toBeTruthy()
    expect(screen.getByRole("link", { name: /Open Meta billing/ }).getAttribute("href")).toContain(
      "business.facebook.com/billing_hub",
    )
    expect(screen.getByRole("button", { name: /I've fixed it/ })).toBeTruthy()
  })

  it("leaves out the button with no account to confirm for", () => {
    render(wrap(<CampaignDeferredBanner campaign={held} />))
    expect(screen.queryByRole("button", { name: /I've fixed it/ })).toBeNull()
  })

  it("does not show the daily-limit copy for a billing hold", () => {
    render(wrap(<CampaignDeferredBanner campaign={held} accountId="acc-1" />))
    expect(screen.queryByText(/daily limit/)).toBeNull()
  })

  it("shows nothing once the campaign is no longer running", () => {
    const { container } = render(
      wrap(<CampaignDeferredBanner campaign={{ ...held, status: "paused" }} accountId="acc-1" />),
    )
    expect(container.textContent).toBe("")
  })

  it("badges a held campaign as held, not running", () => {
    render(<CampaignStatusBadge status="running" deferredReason="meta_payment" />)
    expect(screen.getByText("Held: Meta billing")).toBeTruthy()
  })

  it("words the same hold for a drip sequence", () => {
    render(wrap(<MetaBillingHoldBanner subject="drip" accountId="acc-1" />))
    expect(screen.getByText(/this sequence/)).toBeTruthy()
    expect(screen.getByText(/back on that step/)).toBeTruthy()
    expect(screen.queryByText(/campaign/)).toBeNull()
  })
})
