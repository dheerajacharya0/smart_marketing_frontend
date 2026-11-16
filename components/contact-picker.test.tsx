// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

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
})
