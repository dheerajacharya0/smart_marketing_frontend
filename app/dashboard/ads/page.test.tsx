// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { AdClick, AdSummary } from "@/services/api"

/**
 * Smoke cover for the Ads page: the states a real account hits (loading, no
 * ads yet, a failed request, a list) and the drawer, with the data hooks
 * mocked so nothing reaches the network.
 */

const state: {
  ads: { data?: AdSummary[]; isLoading: boolean; error: unknown }
  clicks: { data?: AdClick[]; isLoading: boolean; error: unknown }
} = {
  ads: { data: [], isLoading: false, error: null },
  clicks: { data: [], isLoading: false, error: null },
}

vi.mock("@/hooks/use-account-id", () => ({
  useAccountId: () => ({ accountId: "acc1", resolved: true, error: null }),
}))
vi.mock("@/hooks/use-queries", () => ({
  useAds: () => state.ads,
  useAdClicks: (_a: string, adKey: string | undefined) =>
    adKey ? state.clicks : { data: undefined, isLoading: false, error: null },
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import AdsPage from "./page"

const AD: AdSummary = {
  adKey: "120200001",
  sourceType: "ad",
  sourceId: "120200001",
  sourceUrl: "https://fb.me/abc",
  headline: "Diwali sale",
  body: "20% off",
  mediaType: "image",
  thumbnailUrl: "https://cdn.example/expired.jpg",
  clicks: 3,
  contacts: 2,
  firstClickAt: "2026-11-01T10:00:00.000Z",
  lastClickAt: "2026-11-02T10:00:00.000Z",
}

const POST: AdSummary = {
  ...AD,
  adKey: "javascript:alert(1)",
  sourceId: null,
  sourceUrl: "javascript:alert(1)",
  sourceType: "post",
  headline: null,
  body: null,
  thumbnailUrl: null,
  clicks: 1,
  contacts: 1,
}

beforeEach(() => {
  state.ads = { data: [], isLoading: false, error: null }
  state.clicks = { data: [], isLoading: false, error: null }
})
afterEach(cleanup)

describe("AdsPage", () => {
  it("explains the page when no ad has started a chat", () => {
    render(<AdsPage />)
    expect(screen.getAllByText("No chats from ads yet").length).toBeGreaterThan(0)
    expect(screen.queryByText("Chats started")).toBeNull()
  })

  it("shows the error instead of the empty state when loading fails", () => {
    state.ads = { data: undefined, isLoading: false, error: new Error("boom") }
    render(<AdsPage />)
    expect(screen.queryByText("No chats from ads yet")).toBeNull()
  })

  it("lists ads with totals", () => {
    state.ads = { data: [AD, POST], isLoading: false, error: null }
    render(<AdsPage />)
    expect(screen.getAllByText("Diwali sale").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Boosted post/).length).toBeGreaterThan(0)
    expect(screen.getByText("Chats started")).toBeTruthy()
  })

  it("falls back to the placeholder when the thumbnail fails to load", () => {
    state.ads = { data: [AD], isLoading: false, error: null }
    const { container } = render(<AdsPage />)
    const imgs = container.querySelectorAll("img")
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach((img) => fireEvent.error(img))
    expect(container.querySelectorAll("img").length).toBe(0)
  })

  it("opens the drawer with people, chat links and a safe ad link", () => {
    state.ads = { data: [AD], isLoading: false, error: null }
    state.clicks = {
      data: [
        { contactWaId: "919800000001", contactName: "Asha", phoneNumberId: "pn1", conversationId: "c1", clickedAt: "2026-11-02T10:00:00.000Z" },
        { contactWaId: "919800000002", contactName: null, phoneNumberId: "pn1", conversationId: null, clickedAt: "2026-11-01T10:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
    }
    render(<AdsPage />)
    fireEvent.click(screen.getAllByText("Diwali sale")[0])
    expect(screen.getByText("People who messaged")).toBeTruthy()
    expect(screen.getByText("Asha")).toBeTruthy()
    expect(screen.getByText("+919800000002")).toBeTruthy()
    expect(screen.getByLabelText("Open the chat with Asha").getAttribute("href")).toBe("/dashboard/chat/c1")
    expect(screen.getByText("No chat")).toBeTruthy()
    const audience = screen.getByText("Build an audience").closest("a")
    expect(audience?.getAttribute("href")).toBe("/dashboard/segments/new?starter=ad%3A120200001")
    expect(screen.getByText("View ad").closest("a")?.getAttribute("href")).toBe("https://fb.me/abc")
  })

  it("never links a non-http ad url", () => {
    state.ads = { data: [POST], isLoading: false, error: null }
    render(<AdsPage />)
    fireEvent.click(screen.getAllByText(/Boosted post/)[0])
    expect(screen.queryByText("View ad")).toBeNull()
  })
})
