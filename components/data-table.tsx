import type { ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  className?: string
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const

/**
 * Shared responsive table for the revamp — column-priority hiding (via
 * `className` on columns), skeleton loading, and an empty slot. Built on the
 * shadcn Table primitives. Wrapped in a horizontal-scroll container so wide
 * tables never break the page layout.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  empty,
  onRowClick,
  skeletonRows = 5,
  className,
}: DataTableProps<T>) {
  const showEmpty = !isLoading && rows.length === 0

  return (
    <div className={cn("responsive-table-container", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(alignClass[col.align ?? "left"], col.className)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
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
            rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
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
  )
}
