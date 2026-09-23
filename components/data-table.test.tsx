// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { DataTable, type Column } from "./data-table"

/**
 * Keyboard cover for clickable rows.
 *
 * `onRowClick` shipped as a bare `onClick` on a `tr` and on a card `div`: no
 * tab stop, no key handler, nothing announced as interactive. Contacts,
 * campaigns and segments all use it, so the only way to open any of those was
 * to point at them — WCAG 2.1.1 Keyboard, Level A.
 *
 * The guard against a keypress inside the row is the part worth pinning. Action
 * buttons live in the last cell, and without it Enter on a Delete button would
 * press the button *and* navigate.
 */

afterEach(cleanup)

interface Row {
  id: string
  name: string
}

const ROWS: Row[] = [
  { id: "a", name: "Ada" },
  { id: "b", name: "Grace" },
]

function columns(onDelete?: () => void): Column<Row>[] {
  return [
    { key: "name", header: "Name", card: "title", cell: (r) => <span>{r.name}</span> },
    {
      key: "actions",
      header: "",
      card: "actions",
      cell: () => (
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      ),
    },
  ]
}

function renderTable(onRowClick?: (row: Row) => void, onDelete?: () => void) {
  return render(
    <DataTable
      columns={columns(onDelete)}
      rows={ROWS}
      getRowKey={(r) => r.id}
      onRowClick={onRowClick}
    />,
  )
}

describe("DataTable row interaction", () => {
  it("gives every clickable row a tab stop", () => {
    renderTable(() => {})
    const rows = document.querySelectorAll('tr[tabindex="0"]')
    expect(rows).toHaveLength(ROWS.length)
  })

  it("leaves rows untabbable when they are not clickable", () => {
    renderTable(undefined)
    expect(document.querySelectorAll('tr[tabindex="0"]')).toHaveLength(0)
  })

  it("opens a row on Enter", () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    const row = document.querySelectorAll('tr[tabindex="0"]')[0]
    fireEvent.keyDown(row, { key: "Enter" })
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0])
  })

  it("ignores Space on a table row, which belongs to page scrolling", () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    fireEvent.keyDown(document.querySelectorAll('tr[tabindex="0"]')[0], { key: " " })
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("does not open the row when Enter was meant for a button inside it", () => {
    const onRowClick = vi.fn()
    const onDelete = vi.fn()
    renderTable(onRowClick, onDelete)
    // The button is the event target; the row is only on the bubble path.
    fireEvent.keyDown(screen.getAllByRole("button", { name: /delete/i })[0], { key: "Enter" })
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("still opens a row on click", () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    fireEvent.click(document.querySelectorAll('tr[tabindex="0"]')[0])
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0])
  })
})
