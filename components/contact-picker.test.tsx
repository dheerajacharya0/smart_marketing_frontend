// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * A failed contacts read used to be caught into an empty list and rendered
 * as "No contacts yet." — a statement about the account made by a dropped
 * request. It has to say it couldn't load, and offer a retry.
 */

const api = vi.hoisted(() => ({ listContacts: vi.fn() }))
vi.mock("@/services/api", () => ({ listContacts: api.listContacts }))

import { ContactPicker } from "./contact-picker"

function renderPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ContactPicker accountId="acc-1" selectedIds={[]} onChange={() => {}} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.listContacts.mockReset()
})
afterEach(cleanup)

describe("ContactPicker", () => {
  it("says it couldn't load, not that there are no contacts", async () => {
    api.listContacts.mockRejectedValue(new Error("network down"))
    renderPicker()

    expect(await screen.findByText("Couldn't load contacts.")).toBeTruthy()
    expect(screen.queryByText("No contacts yet.")).toBeNull()
  })

  it("retries and shows the contacts once the read succeeds", async () => {
    api.listContacts.mockImplementationOnce(async () => {
      throw new Error("network down")
    })
    renderPicker()
    const retry = await screen.findByRole("button", { name: "Try again" })

    api.listContacts.mockResolvedValue({ items: [{ id: "c1", name: "Asha", waId: "919800000000" }], total: 1 })
    fireEvent.click(retry)

    expect(await screen.findByText(/Asha/)).toBeTruthy()
    expect(screen.queryByText("Couldn't load contacts.")).toBeNull()
  })

  it("still says 'No contacts yet.' when the account really has none", async () => {
    api.listContacts.mockResolvedValue({ items: [], total: 0 })
    renderPicker()

    expect(await screen.findByText("No contacts yet.")).toBeTruthy()
  })

  describe("'first 25' footer", () => {
    const contact = (i: number) => ({ id: `c${i}`, name: `Person ${i}`, waId: `9198000000${i}` })

    it("is hidden under an error", async () => {
      api.listContacts.mockRejectedValue(new Error("network down"))
      renderPicker()

      await screen.findByText("Couldn't load contacts.")
      expect(screen.queryByText(/Showing the first/)).toBeNull()
    })

    it("is hidden when fewer than a page came back", async () => {
      api.listContacts.mockResolvedValue({ items: [contact(1), contact(2)], total: 2 })
      renderPicker()

      await screen.findByText(/Person 1/)
      expect(screen.queryByText(/Showing the first/)).toBeNull()
    })

    it("shows when a full page came back", async () => {
      api.listContacts.mockResolvedValue({
        items: Array.from({ length: 25 }, (_, i) => contact(i)),
        total: 80,
      })
      renderPicker()

      expect(await screen.findByText(/Showing the first 25 matches/)).toBeTruthy()
    })

    it("is hidden when a full page is everyone", async () => {
      api.listContacts.mockResolvedValue({
        items: Array.from({ length: 25 }, (_, i) => contact(i)),
        total: 25,
      })
      renderPicker()

      await screen.findByText(/Person 24/)
      expect(screen.queryByText(/Showing the first/)).toBeNull()
    })

    it("keeps the selected count on a short list", async () => {
      api.listContacts.mockResolvedValue({ items: [contact(1), contact(2)], total: 2 })
      // The picker drops selections the parent doesn't hold, so the parent
      // has to keep them, as every real call site does.
      function Harness() {
        const [ids, setIds] = useState<string[]>([])
        return <ContactPicker accountId="acc-1" selectedIds={ids} onChange={setIds} />
      }
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>,
      )

      fireEvent.click((await screen.findAllByRole("checkbox"))[0])
      expect(await screen.findByText("1 selected.")).toBeTruthy()
    })
  })
})
