"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "@/components/status-pill"
import { useAdminSupportTickets } from "@/hooks/use-queries"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { getUserDataFromCookie, updateAdminSupportTicket, type SupportTicketStatus } from "@/services/api"

/**
 * Platform-admin-only ticket queue, unlinked from any nav — bookmark-only,
 * same "ops tool, not a customer page" positioning as the number-recovery
 * admin tool. Not gated client-side beyond requiring a session: every call
 * here 403s for anyone whose account isn't `role = 'admin'` (AdminGuard on
 * the backend), and that 403 is what this page shows as its access gate.
 */

const STATUS_FILTERS: { value: SupportTicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

export default function AdminSupportPage() {
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "all">("open")
  const { data: tickets, isLoading, error, refetch } = useAdminSupportTickets(
    statusFilter === "all" ? {} : { status: statusFilter }
  )
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const me = getUserDataFromCookie()

  const runUpdate = async (id: string, changes: { status?: SupportTicketStatus; assignedToUserId?: string | null }) => {
    setUpdatingId(id)
    setActionError(null)
    try {
      await updateAdminSupportTicket(id, changes)
      await refetch()
    } catch (err) {
      setActionError(getErrorMessage(err, "Couldn't update the ticket"))
    } finally {
      setUpdatingId(null)
    }
  }

  const gateStatus = getErrorStatus(error)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Support tickets (admin)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every ticket filed from the dashboard&apos;s Help &amp; Support page. Assign one to yourself,
          work it over email, then mark it resolved here.
        </p>
      </div>

      {gateStatus === 403 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your account isn&apos;t a platform admin, so this queue is hidden from you.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Tickets</CardTitle>
              <CardDescription>Filtered by status.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SupportTicketStatus | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && gateStatus !== 403 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{getErrorMessage(error, "Couldn't load tickets")}</AlertDescription>
              </Alert>
            )}
            {actionError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
            {tickets && tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">No tickets match this filter.</p>
            )}
            {tickets && tickets.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate font-medium">{t.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.category}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium">{t.accountName ?? t.accountId}</p>
                        {t.accountOwnerEmail ? (
                          <a
                            href={`mailto:${t.accountOwnerEmail}?subject=${encodeURIComponent(`Re: ${t.subject}`)}`}
                            className="text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {t.accountOwnerEmail}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No owner email on file</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.status}
                          onValueChange={(v) => runUpdate(t.id, { status: v as SupportTicketStatus })}
                          disabled={updatingId === t.id}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue>
                              <StatusPill status={t.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.assignedToUserId ?? <span className="text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!t.assignedToUserId && me?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updatingId === t.id}
                              onClick={() => runUpdate(t.id, { assignedToUserId: me.id })}
                            >
                              Assign to me
                            </Button>
                          )}
                          {t.assignedToUserId === me?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updatingId === t.id}
                              onClick={() => runUpdate(t.id, { assignedToUserId: null })}
                            >
                              Unassign
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
