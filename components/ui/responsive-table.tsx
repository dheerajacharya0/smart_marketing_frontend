"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

// Rows are keyed records; the generic <T> lets callers pass their own row shape.
type RowLike = Record<string, React.ReactNode>

interface Column<T> {
  header: string
  accessorKey: string | ((row: T) => React.ReactNode)
  cell?: (row: T) => React.ReactNode
  hideOnMobile?: boolean
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  pagination?: boolean
  itemsPerPage?: number
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
}

export function ResponsiveTable<T extends RowLike>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  pagination = false,
  itemsPerPage = 10,
  onRowClick,
  emptyState,
}: ResponsiveTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)

    return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  // Filter data based on search term
  const filteredData = searchable
    ? data.filter((item) => {
        return Object.keys(item).some((key) => {
          const value = item[key]
          if (typeof value === "string") {
            return value.toLowerCase().includes(searchTerm.toLowerCase())
          }
          return false
        })
      })
    : data

  // Paginate data
  const totalPages = pagination ? Math.ceil(filteredData.length / itemsPerPage) : 1
  const paginatedData = pagination
    ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredData

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Get visible columns based on screen size
  const visibleColumns = isMobile ? columns.filter((col) => !col.hideOnMobile) : columns

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            className="pl-8"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
          />
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column, index) => (
                  <TableHead key={index}>{column.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="h-24 text-center">
                    {emptyState || "No results found."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  >
                    {visibleColumns.map((column, colIndex) => (
                      <TableCell key={colIndex}>
                        {typeof column.accessorKey === "function"
                          ? column.accessorKey(row)
                          : column.cell
                            ? column.cell(row)
                            : row[column.accessorKey]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
