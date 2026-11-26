// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { AdSummary } from "@/services/api"
import { emptyCondition, type GroupDraft } from "@/lib/segment-rules"
import { RuleGroupEditor, type RuleEditorOptions } from "./rule-group-editor"

/** The "Came from an ad" row: its ad picker and its empty-list note. */

afterEach(cleanup)

const AD: AdSummary = {
  adKey: "1",
  sourceType: "ad",
  sourceId: "1",
  sourceUrl: null,
  headline: "Diwali sale",
  body: null,
  mediaType: null,
  thumbnailUrl: null,
  clicks: 1,
  contacts: 1,
  firstClickAt: "2026-11-01T10:00:00.000Z",
  lastClickAt: "2026-11-02T10:00:00.000Z",
}

function group(adKey: string): GroupDraft {
  return {
    combinator: "and",
    conditions: [{ ...emptyCondition(), type: "ad", operator: "within", days: "30", adKey }],
  }
}

function renderWith(g: GroupDraft, ads: AdSummary[]) {
  const options: RuleEditorOptions = { attributeKeys: [], knownTags: [], campaigns: [], ads }
  render(<RuleGroupEditor group={g} onChange={vi.fn()} options={options} />)
}

describe("ad segment row", () => {
  it("shows the chosen ad by name", () => {
    renderWith(group("1"), [AD])
    expect(screen.getByText("Diwali sale")).toBeTruthy()
    expect(screen.getByText("messaged from an ad in last")).toBeTruthy()
  })

  it("keeps a saved ad that is no longer listed instead of showing any ad", () => {
    renderWith(group("gone"), [AD])
    expect(screen.getByText("Selected ad")).toBeTruthy()
  })

  it("warns that the row matches nobody before any ad chat exists", () => {
    renderWith(group(""), [])
    expect(screen.getByText("Any ad")).toBeTruthy()
    expect(screen.getByText(/This matches nobody until one does/)).toBeTruthy()
  })
})
