"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface Column<T> {
  /** Stable key for the column. */
  key: string
  header: ReactNode
  /** Cell renderer for a row. */
  cell: (row: T) => ReactNode
  /** Extra classes on both header + cell — use responsive `hide-on-lg/md/sm`. */
  className?: string
  align?: "left" | "right" | "center"
  /**
   * Makes the column sortable. Return a comparable primitive; `null`/`undefined`
   * always sort last regardless of direction, so empty cells don't crowd the top.
   */
  sortValue?: (row: T) => string | number | null | undefined
  /**
   * Where this column goes on the narrow-screen card. A table squeezed onto a
   * phone is unreadable, so below `md` each row is recomposed as a card:
   *
   *   title   — the heading (usually the row's link)
   *   meta    — a quiet line under the title
   *   body    — a labelled field in the card's detail list (the default)
   *   actions — pinned to the card's footer
   *   hidden  — dropped on mobile entirely
   */
  card?: "title" | "meta" | "body" | "actions" | "hidden"
  /** Label for this field on the card. Defaults to `header`. */
  cardLabel?: ReactNode
}

export interface DataTablePagination {
  offset: number
  pageSize: number
  total: number
  onOffsetChange: (offset: number) => void
  /** Noun for the footer count, e.g. "contact". Defaults to "row". */
  noun?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  /** Stable row key. */
  getRowKey: (row: T) => string
  isLoading?: boolean
  /** Rendered in place of the table body when not loading and rows is empty. */
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Skeleton row count while loading. */
  skeletonRows?: number
  /** Filters/search, rendered above the table inside the same container. */
  toolbar?: ReactNode
  /** Adds a pager below the table. Omit for un-paged lists. */
  pagination?: DataTablePagination
  /** Column key to sort by initially. */
  defaultSortKey?: string
  defaultSortDirection?: SortDirection
  /**
   * Set when the rows are already ordered by the server and client-side
   * sorting would only reorder the current page.
   */
  disableSorting?: boolean
  className?: string
}

type SortDirection = "asc" | "desc"

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const

const justifyClass = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
} as const

function compare(a: unknown, b: unknown): number {
  // Empty values sort last in both directions — an unset field is not a
  // meaningful "smallest" value, it's an absence.
  const aEmpty = a === null || a === undefined || a === ""
  const bEmpty = b === null || b === undefined || b === ""
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
}

/**
 * The shared list surface. Every table in the product goes through this so
 * sorting, loading, empty states, pagination and the mobile card layout behave
 * the same everywhere — and so a change to any of them is made once.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  empty,
  onRowClick,
  skeletonRows = 5,
  toolbar,
  pagination,
  defaultSortKey,
  defaultSortDirection = "asc",
  disableSorting,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection)

  const sortColumn = disableSorting ? undefined : columns.find((c) => c.key === sortKey && c.sortValue)

  const sortedRows = useMemo(() => {
    if (!sortColumn?.sortValue) return rows
    const get = sortColumn.sortValue
    const factor = sortDirection === "asc" ? 1 : -1
    // Sort a copy: the caller's array is state somewhere.
    return [...rows].sort((a, b) => {
      const result = compare(get(a), get(b))
      // Empty-last must survive the direction flip, so only real comparisons
      // get inverted.
      if (result === 0) return 0
      const aEmpty = get(a) === null || get(a) === undefined || get(a) === ""
      const bEmpty = get(b) === null || get(b) === undefined || get(b) === ""
      if (aEmpty || bEmpty) return result
      return result * factor
    })
  }, [rows, sortColumn, sortDirection])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection("asc")
  }

  const showEmpty = !isLoading && rows.length === 0

  const titleColumn = columns.find((c) => c.card === "title") ?? columns[0]
  const metaColumns = columns.filter((c) => c.card === "meta")
  const actionColumns = columns.filter((c) => c.card === "actions")
  const bodyColumns = columns.filter(
    (c) => c !== titleColumn && !["meta", "actions", "hidden", "title"].includes(c.card ?? ""),
  )

  const pageStart = pagination ? (pagination.total === 0 ? 0 : pagination.offset + 1) : 0
  const pageEnd = pagination ? Math.min(pagination.offset + pagination.pageSize, pagination.total) : 0

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}

      {/* ---------- Table: md and up ---------- */}
      <div className="hidden md:block responsive-table-container">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const sortable = !disableSorting && !!col.sortValue
                const active = sortable && sortKey === col.key
                return (
                  <TableHead
                    key={col.key}
                    aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(alignClass[col.align ?? "left"], col.className)}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "focus-ring -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5",
                          "transition-colors duration-fast ease-out-soft hover:text-foreground",
                          justifyClass[col.align ?? "left"],
                          active && "text-foreground",
                        )}
                      >
                        {col.header}
                        {active ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : showEmpty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row, i) => (
                <TableRow
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{ "--signal-index": Math.min(i, 7) } as React.CSSProperties}
                  className={cn("signal-fade", onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(alignClass[col.align ?? "left"], col.className)}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---------- Cards: below md ----------
          Not a shrunken table. Each row becomes a card with a heading, a quiet
          meta line, labelled fields, and its actions pinned to the footer. */}
      <div className="space-y-2.5 md:hidden">
        {isLoading ? (
          Array.from({ length: Math.min(skeletonRows, 4) }).map((_, i) => (
            <div key={`card-skeleton-${i}`} className="space-y-2.5 rounded-lg border border-border-subtle bg-card p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : showEmpty ? (
          <div className="rounded-lg border border-border-subtle bg-card">{empty}</div>
        ) : (
          sortedRows.map((row, i) => (
            <div
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ "--signal-index": Math.min(i, 7) } as React.CSSProperties}
              className={cn(
                "signal-rise rounded-lg border border-border-subtle bg-card p-4 shadow-xs",
                onRowClick && "cursor-pointer",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{titleColumn?.cell(row)}</div>
                  {metaColumns.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {metaColumns.map((col) => (
                        <span key={col.key}>{col.cell(row)}</span>
                      ))}
                    </div>
                  )}
                </div>
                {actionColumns.length > 0 && (
                  <div
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionColumns.map((col) => (
                      <span key={col.key}>{col.cell(row)}</span>
                    ))}
                  </div>
                )}
              </div>

              {bodyColumns.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 border-t border-border-subtle/70 pt-3 text-sm">
                  {bodyColumns.map((col) => (
                    <div key={col.key} className="contents">
                      <dt className="text-xs uppercase tracking-label text-muted-foreground">
                        {col.cardLabel ?? col.header}
                      </dt>
                      <dd className="min-w-0 text-sm">{col.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))
        )}
      </div>

      {/* ---------- Pager ---------- */}
      {pagination && !showEmpty && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {pagination.total === 0 ? (
              "Nothing to show"
            ) : (
              <>
                <span className="font-mono tabular-nums">
                  {pageStart}–{pageEnd}
                </span>{" "}
                of{" "}
                <span className="font-mono tabular-nums">{pagination.total.toLocaleString()}</span>{" "}
                {pagination.noun ?? "row"}
                {pagination.total === 1 ? "" : "s"}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.offset === 0 || isLoading}
              onClick={() => pagination.onOffsetChange(Math.max(0, pagination.offset - pagination.pageSize))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageEnd >= pagination.total || isLoading}
              onClick={() => pagination.onOffsetChange(pagination.offset + pagination.pageSize)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
