// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * The dialog used to be handed the contacts page's tag list, which a failed
 * read had turned into [] — so it said "No tags yet" on an account full of
 * them. It reads the tags itself now and keeps the failure apart.
 */

const api = vi.hoisted(() => ({ listContactTags: vi.fn() }))
vi.mock("@/services/api", () => ({
  listContactTags: api.listContactTags,
  renameContactTag: vi.fn(),
  deleteContactTag: vi.fn(),
}))

import { ManageTagsDialog } from "./manage-tags-dialog"

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ManageTagsDialog open onOpenChange={() => {}} accountId="a1" onChanged={() => {}} onShowContacts={() => {}} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.listContactTags.mockReset()
})
afterEach(cleanup)

describe("ManageTagsDialog", () => {
  it("says it couldn't load, not that there are no tags", async () => {
    api.listContactTags.mockRejectedValue(new Error("network down"))
    renderDialog()

    expect(await screen.findByText("Couldn't load your tags.")).toBeTruthy()
    expect(screen.queryByText("No tags yet")).toBeNull()
  })

  it("retries into the tag list", async () => {
    api.listContactTags.mockRejectedValue(new Error("network down"))
    renderDialog()
    const retry = await screen.findByRole("button", { name: "Try again" })

    api.listContactTags.mockResolvedValue([{ tag: "vip", count: 3 }])
    fireEvent.click(retry)
    expect(await screen.findByText(/vip/)).toBeTruthy()
  })

  it("still says 'No tags yet' when the account has none", async () => {
    api.listContactTags.mockResolvedValue([])
    renderDialog()

    expect(await screen.findByText("No tags yet")).toBeTruthy()
  })
})
