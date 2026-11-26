// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { AdSummary, AutomationTrigger } from "@/services/api"

/** The "Someone messages from an ad" picker, with the ad list mocked. */

const ads: { data?: AdSummary[]; isLoading: boolean; error: unknown } = {
  data: [],
  isLoading: false,
  error: null,
}

vi.mock("@/hooks/use-queries", () => ({ useAds: () => ads }))

import { RuleTriggerEditor } from "./rule-trigger-editor"

const AD = (adKey: string, headline: string): AdSummary => ({
  adKey,
  sourceType: "ad",
  sourceId: adKey,
  sourceUrl: null,
  headline,
  body: null,
  mediaType: null,
  thumbnailUrl: null,
  clicks: 2,
  contacts: 2,
  firstClickAt: "2026-11-01T10:00:00.000Z",
  lastClickAt: "2026-11-02T10:00:00.000Z",
})

function renderWith(trigger: AutomationTrigger) {
  const onChange = vi.fn()
  render(<RuleTriggerEditor accountId="acc1" trigger={trigger} onChange={onChange} issues={[]} />)
  return onChange
}

beforeEach(() => {
  ads.data = []
  ads.isLoading = false
  ads.error = null
})
afterEach(cleanup)

describe("ad_click trigger picker", () => {
  it("says it fires for any ad when there are none yet", () => {
    renderWith({ type: "ad_click", adKeys: [] })
    expect(screen.getByText(/No chats have come from a Click-to-WhatsApp ad yet/)).toBeTruthy()
    expect(screen.getByText(/replies to a chat from any ad/)).toBeTruthy()
  })

  it("ticks and unticks ads", () => {
    ads.data = [AD("1", "Diwali sale"), AD("2", "New year")]
    const onChange = renderWith({ type: "ad_click", adKeys: ["1"] })
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(2)
    expect(boxes[0].getAttribute("data-state")).toBe("checked")
    fireEvent.click(boxes[1])
    expect(onChange).toHaveBeenLastCalledWith({ type: "ad_click", adKeys: ["1", "2"] })
    fireEvent.click(boxes[0])
    expect(onChange).toHaveBeenLastCalledWith({ type: "ad_click", adKeys: [] })
  })

  it("keeps a saved ad that left the list visible so it can be removed", () => {
    ads.data = [AD("1", "Diwali sale")]
    const onChange = renderWith({ type: "ad_click", adKeys: ["old"] })
    expect(screen.getByText("Ad with no chats in the last year")).toBeTruthy()
    const boxes = screen.getAllByRole("checkbox")
    fireEvent.click(boxes[1])
    expect(onChange).toHaveBeenLastCalledWith({ type: "ad_click", adKeys: [] })
  })

  it("tells the user when the list fails, without blocking the rule", () => {
    ads.data = undefined
    ads.error = new Error("boom")
    renderWith({ type: "ad_click", adKeys: [] })
    expect(screen.getByText(/Couldn't load your ads/)).toBeTruthy()
  })
})
