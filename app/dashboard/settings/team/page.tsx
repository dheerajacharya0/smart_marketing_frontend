"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "react-hot-toast"
import {
  addTeamMember,
  updateTeamMemberRole,
  deleteTeamMember,
  type TeamMember,
  type TeamRole,
} from "@/services/api"
import { useAccountId } from "@/hooks/use-account-id"
import { useTeamMembers } from "@/hooks/use-team-members"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?"
}

function RoleBadge({ role }: { role: TeamRole }) {
  if (role === "owner")
    return (
      <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-400">
        Owner
      </Badge>
    )
  if (role === "admin")
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">
        Admin
      </Badge>
    )
  return <Badge variant="secondary">Agent</Badge>
}

export default function TeamSettingsPage() {
  const { accountId, resolved } = useAccountId()
  const { owner, members, canManage, currentUserId, loading, error, refetch } = useTeamMembers(accountId)

  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "agent">("agent")
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!accountId) return
    setAddError(null)
    if (!email.trim()) {
      setAddError("Enter an email address")
      return
    }
    setIsAdding(true)
    try {
      await addTeamMember(accountId, email.trim(), role)
      toast.success("Member added")
      setShowAdd(false)
      setEmail("")
      setRole("agent")
      refetch()
    } catch (err: any) {
      // 404 (no such user), 409 (already member), 400 (owner) all belong inline
      setAddError(err?.message || "Failed to add member")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRoleChange = async (member: TeamMember, newRole: "admin" | "agent") => {
    if (!accountId || newRole === member.role) return
    setBusyMemberId(member.id)
    try {
      await updateTeamMemberRole(member.id, accountId, newRole)
      toast.success("Role updated")
      refetch()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role")
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleRemove = async (member: TeamMember) => {
    if (!accountId) return
    setBusyMemberId(member.id)
    try {
      await deleteTeamMember(member.id, accountId)
      toast.success("Member removed")
      refetch()
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member")
    } finally {
      setBusyMemberId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

  // owner + members flattened into displayable rows
  const rows: {
    key: string
    userId: string
    name: string
    email: string
    role: TeamRole
    joined?: string
    member?: TeamMember
  }[] = [
    ...(owner
      ? [{ key: "owner", userId: owner.userId, name: owner.name, email: owner.email, role: "owner" as TeamRole }]
      : []),
    ...members.map((m) => ({
      key: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role as TeamRole,
      joined: m.createdAt,
      member: m,
    })),
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/dashboard/settings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Settings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Team</h1>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)} disabled={!accountId}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Everyone here can see and work all of this account's conversations.
            {!canManage && !loading && " Only the owner and admins can manage the team."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!resolved || loading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : !accountId ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                      No connected account yet.
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isOwnerRow = row.role === "owner"
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{initials(row.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {row.name}
                              {row.userId === currentUserId && (
                                <span className="text-xs text-muted-foreground"> (you)</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                        <TableCell>
                          {canManage && !isOwnerRow && row.member ? (
                            <Select
                              value={row.role}
                              onValueChange={(v) => handleRoleChange(row.member!, v as "admin" | "agent")}
                              disabled={busyMemberId === row.member.id}
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={row.role} />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.joined ? formatDate(row.joined) : "—"}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {!isOwnerRow && row.member ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={busyMemberId === row.member.id}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    {busyMemberId === row.member.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove {row.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      They lose access to this account's conversations. This can't be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(row.member!)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          setShowAdd(open)
          if (!open) {
            setEmail("")
            setRole("agent")
            setAddError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite an existing user by email. They must already have an account to be added.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "agent")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent — works conversations</SelectItem>
                  <SelectItem value="admin">Admin — also manages the team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isAdding}>
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
