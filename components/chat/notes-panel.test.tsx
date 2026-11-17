// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

/**
 * A failed notes read used to leave the list empty and say "No notes yet" —
 * telling an agent there was no context on a conversation that has some.
 */

const api = vi.hoisted(() => ({ getConversationNotes: vi.fn() }))
vi.mock("@/services/api", () => ({
  getConversationNotes: api.getConversationNotes,
  addConversationNote: vi.fn(),
  deleteConversationNote: vi.fn(),
  getUserDataFromCookie: () => ({ id: "u1" }),
}))

import { NotesPanel } from "./notes-panel"

const NOTE = { id: "n1", body: "Asked for a refund", authorName: "Asha", authorId: "u2", createdAt: "2026-11-17T10:00:00Z" }

beforeEach(() => {
  api.getConversationNotes.mockReset()
})
afterEach(cleanup)

describe("NotesPanel", () => {
  it("says it couldn't load, not that there are no notes", async () => {
    api.getConversationNotes.mockRejectedValue(new Error("network down"))
    render(<NotesPanel conversationId="c1" accountId="a1" onClose={() => {}} />)

    expect(await screen.findByText("network down")).toBeTruthy()
    expect(screen.queryByText(/No notes yet/)).toBeNull()
  })

  it("retries into the notes", async () => {
    api.getConversationNotes.mockRejectedValueOnce(new Error("network down")).mockResolvedValue([NOTE])
    render(<NotesPanel conversationId="c1" accountId="a1" onClose={() => {}} />)

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Asked for a refund")).toBeTruthy()
  })

  it("still says 'No notes yet' when there are none", async () => {
    api.getConversationNotes.mockResolvedValue([])
    render(<NotesPanel conversationId="c1" accountId="a1" onClose={() => {}} />)

    expect(await screen.findByText(/No notes yet/)).toBeTruthy()
  })

  it("drops the previous conversation's notes when switching, even if the new read fails", async () => {
    api.getConversationNotes.mockResolvedValueOnce([NOTE])
    const { rerender } = render(<NotesPanel conversationId="c1" accountId="a1" onClose={() => {}} />)
    await screen.findByText("Asked for a refund")

    api.getConversationNotes.mockRejectedValueOnce(new Error("network down"))
    rerender(<NotesPanel conversationId="c2" accountId="a1" onClose={() => {}} />)

    expect(await screen.findByText("network down")).toBeTruthy()
    expect(screen.queryByText("Asked for a refund")).toBeNull()
  })
})
