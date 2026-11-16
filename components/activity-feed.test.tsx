// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { ActivityFeed } from "./activity-feed"

/**
 * When the campaign list fails, the feed only knows half the story. It must
 * not say "Nothing has happened yet." about an account it couldn't read.
 */

afterEach(cleanup)

describe("ActivityFeed", () => {
  it("doesn't claim nothing happened when campaigns failed to load", () => {
    render(<ActivityFeed campaigns={[]} alerts={[]} campaignsFailed onRetryCampaigns={() => {}} />)

    expect(screen.getByText("Couldn't load campaign activity.")).toBeTruthy()
    expect(screen.queryByText(/Nothing has happened yet/)).toBeNull()
  })

  it("keeps the empty state for an account that really has no activity", () => {
    render(<ActivityFeed campaigns={[]} alerts={[]} />)

    expect(screen.getByText(/Nothing has happened yet/)).toBeTruthy()
  })
})
