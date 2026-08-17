"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
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
  updateTeamMember,
  createTeamInvite,
  listTeamInvites,
  revokeTeamInvite,
  acceptTeamInvite,
  deleteTeamMember,
  type ConversationScope,
  type CreatedTeamInvite,
  type InviteStatus,
  type TeamInvite,
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

/**
 * How much of the shared inbox an agent sees. Phrased as what they *can* open
 * rather than as the stored enum — "unassigned_and_own" tells an owner nothing
 * about who will answer a new customer.
 */
const SCOPE_OPTIONS: { value: ConversationScope; label: string; hint: string }[] = [
  { value: "all", label: "All conversations", hint: "Everything on this account." },
  {
    value: "unassigned_and_own",
    label: "Queue + assigned to them",
    hint: "Unclaimed conversations plus their own — the usual setting for a shared queue.",
  },
  {
    value: "own",
    label: "Only assigned to them",
    hint: "Nothing until someone assigns it to them.",
  },
]

function scopeLabel(scope: ConversationScope | undefined): string {
  return SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? "All conversations"
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">
          Waiting
        </Badge>
      )
    case "accepted":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
          Accepted
        </Badge>
      )
    case "revoked":
      return <Badge variant="secondary">Revoked</Badge>
    case "expired":
      return <Badge variant="outline">Expired</Badge>
  }
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
  const [scope, setScope] = useState<ConversationScope>("all")
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [createdInvite, setCreatedInvite] = useState<CreatedTeamInvite | null>(null)
  const [inviteCode, setInviteCode] = useState("")
  const [isAccepting, setIsAccepting] = useState(false)

  const handleAdd = async () => {
    if (!accountId) return
    setAddError(null)
    if (!email.trim()) {
      setAddError("Enter an email address")
      return
    }
    setIsAdding(true)
    // Scope is only sent for an agent — an admin resolves to `all` server-side
    // regardless, so sending one would record a restriction that isn't real.
    const conversationScope = role === "agent" ? scope : undefined
    try {
      await addTeamMember(accountId, email.trim(), role, conversationScope)
      toast.success("Member added")
      setShowAdd(false)
      setEmail("")
      setRole("agent")
      setScope("all")
      refetch()
    } catch (err) {
      // 404 means the address has no account here yet, which is the case invites
      // exist for — fall through to one rather than making the person go and
      // register first and then come back. Any other failure (409 already a
      // member, 400 the owner) is a real answer and belongs inline.
      if (getErrorStatus(err) !== 404) {
        setAddError(getErrorMessage(err) || "Failed to add member")
        setIsAdding(false)
        return
      }
      try {
        const invite = await createTeamInvite({
          accountId,
          email: email.trim(),
          role,
          conversationScope,
        })
        // The token is readable exactly once, in this response — only its hash
        // is stored. Hold it on screen until it's copied rather than closing
        // the dialog on success as the direct-add path does.
        setCreatedInvite(invite)
        setShowAdd(false)
        setEmail("")
        fetchInvites()
      } catch (inviteErr) {
        setAddError(getErrorMessage(inviteErr) || "Failed to invite")
      }
    } finally {
      setIsAdding(false)
    }
  }

  const fetchInvites = useCallback(async () => {
    if (!accountId || !canManage) return
    setInvitesLoading(true)
    try {
      const res = await listTeamInvites(accountId)
      setInvites(Array.isArray(res) ? res : [])
    } catch {
      // Invites are secondary to the member list; a failure here shouldn't
      // replace the page with an error.
      setInvites([])
    } finally {
      setInvitesLoading(false)
    }
  }, [accountId, canManage])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const handleRevokeInvite = async (invite: TeamInvite) => {
    if (!accountId) return
    setBusyInviteId(invite.id)
    try {
      await revokeTeamInvite(invite.id, accountId)
      toast.success("Invitation revoked")
      fetchInvites()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to revoke")
    } finally {
      setBusyInviteId(null)
    }
  }

  const handleAcceptInvite = async () => {
    if (!inviteCode.trim()) return
    setIsAccepting(true)
    try {
      await acceptTeamInvite(inviteCode.trim())
      toast.success("Invitation accepted — you now have access")
      setInviteCode("")
      refetch()
    } catch (err) {
      // The server answers every rejection identically on purpose; pass its
      // message through rather than guessing at a more specific reason.
      toast.error(getErrorMessage(err) || "That invitation code didn't work")
    } finally {
      setIsAccepting(false)
    }
  }

  const handleRoleChange = async (member: TeamMember, newRole: "admin" | "agent") => {
    if (!accountId || newRole === member.role) return
    setBusyMemberId(member.id)
    try {
      await updateTeamMember(member.id, accountId, { role: newRole })
      toast.success("Role updated")
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update role")
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleScopeChange = async (member: TeamMember, scope: ConversationScope) => {
    if (!accountId || scope === member.conversationScope) return
    setBusyMemberId(member.id)
    try {
      await updateTeamMember(member.id, accountId, { conversationScope: scope })
      toast.success("Inbox access updated")
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update inbox access")
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
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to remove member")
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
            Admins and the owner always see every conversation; an agent sees as much of the inbox
            as their access allows.
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
                  <TableHead>Inbox access</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!resolved || loading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : !accountId ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="h-24 text-center text-muted-foreground">
                      No connected account yet.
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="h-24 text-center text-destructive">
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
                        <TableCell>
                          {isOwnerRow || row.role === "admin" ? (
                            // Not a dropdown: the server resolves an admin and the
                            // owner to `all` whatever is stored, so offering a
                            // choice here would be a control that does nothing.
                            <span className="text-sm text-muted-foreground">
                              All conversations
                            </span>
                          ) : canManage && row.member ? (
                            <Select
                              value={row.member.conversationScope}
                              onValueChange={(v) =>
                                handleScopeChange(row.member!, v as ConversationScope)
                              }
                              disabled={busyMemberId === row.member.id}
                            >
                              <SelectTrigger className="h-8 w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SCOPE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {scopeLabel(row.member?.conversationScope)}
                            </span>
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

      {canManage && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Sent to people without an account here yet. Each expires after seven days and works
              once, for the address it was sent to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Inbox access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={invite.role} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invite.role === "admin"
                            ? "All conversations"
                            : scopeLabel(invite.conversationScope)}
                        </TableCell>
                        <TableCell>
                          <InviteStatusBadge status={invite.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Only a live invite can be revoked — an accepted or
                              expired one is history, and the row is kept so
                              "who was invited" stays answerable. */}
                          {invite.status === "pending" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyInviteId === invite.id}
                              onClick={() => handleRevokeInvite(invite)}
                            >
                              {busyInviteId === invite.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Revoke"
                              )}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Have an invitation code?</CardTitle>
          <CardDescription>
            Enter it to join a team you&apos;ve been invited to. It only works for the email
            address you&apos;re signed in with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-code">Invitation code</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste the code from your email"
                className="w-80 font-mono text-xs"
              />
            </div>
            <Button onClick={handleAcceptInvite} disabled={!inviteCode.trim() || isAccepting}>
              {isAccepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!createdInvite} onOpenChange={(open) => !open && setCreatedInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation created</DialogTitle>
            <DialogDescription>
              {createdInvite?.email} doesn&apos;t have an account here yet, so we sent them an
              invitation. It&apos;s also emailed, but copy the code now if you want to pass it on
              yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input readOnly value={createdInvite?.token ?? ""} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  if (!createdInvite) return
                  navigator.clipboard?.writeText(createdInvite.token)
                  toast.success("Code copied")
                }}
              >
                Copy
              </Button>
            </div>
            {/* Only the hash is stored, so this really is the only time it can
                be read — saying so is the difference between someone copying it
                now and coming back for it later. */}
            <p className="text-xs text-muted-foreground">
              This code is shown once and can&apos;t be retrieved later. If it&apos;s lost, revoke
              the invitation and send a new one.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedInvite(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          setShowAdd(open)
          if (!open) {
            setEmail("")
            setRole("agent")
            setScope("all")
            setAddError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add someone by email. If they already have an account they&apos;re added straight
              away; if not, we&apos;ll send them an invitation instead.
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
            {role === "agent" && (
              <div className="grid gap-2">
                <Label>Inbox access</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as ConversationScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {SCOPE_OPTIONS.find((option) => option.value === scope)?.hint}
                </p>
              </div>
            )}
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
