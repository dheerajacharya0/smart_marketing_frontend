"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2, TriangleAlert, UserPlus, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
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
/** The owner and each member, flattened into one displayable shape. */
type TeamRow = {
  key: string
  userId: string
  name: string
  email: string
  role: TeamRole
  joined?: string
  member?: TeamMember
}

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
        <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">
          Waiting
        </Badge>
      )
    case "accepted":
      return (
        <Badge className="bg-success-soft text-success hover:bg-success-soft">
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
      <Badge className="bg-chart-4/10 text-chart-4 hover:bg-chart-4/10">
        Owner
      </Badge>
    )
  if (role === "admin")
    return (
      <Badge className="bg-info-soft text-info hover:bg-info-soft">
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
  const [invitesError, setInvitesError] = useState<string | null>(null)
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
      setInvitesError(null)
    } catch (err) {
      // Invites are secondary to the member list, so a failure here doesn't
      // replace the page with an error — but it isn't swallowed either. The
      // card renders with the failure inside it, because an admin whose
      // outstanding invites silently vanished has no way to revoke one.
      setInvites([])
      setInvitesError(getErrorMessage(err) || "Couldn't load the outstanding invitations")
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
  const rows: TeamRow[] = [
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

  // One definition drives the desktop table and the phone card list. The
  // owner row is first and stays first until someone sorts a column.
  const memberColumns: Column<TeamRow>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (row) => row.name,
      cell: (row) => (
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
      ),
    },
    {
      key: "email",
      header: "Email",
      card: "meta",
      sortValue: (row) => row.email,
      cell: (row) => <span className="text-sm text-muted-foreground">{row.email}</span>,
    },
    {
      key: "role",
      header: "Role",
      cardLabel: "Role",
      sortValue: (row) => row.role,
      cell: (row) =>
        canManage && row.role !== "owner" && row.member ? (
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
        ),
    },
    {
      key: "scope",
      header: "Inbox access",
      cardLabel: "Inbox access",
      cell: (row) =>
        row.role === "owner" || row.role === "admin" ? (
          // Not a dropdown: the server resolves an admin and the owner to
          // `all` whatever is stored, so offering a choice here would be a
          // control that does nothing.
          <span className="text-sm text-muted-foreground">All conversations</span>
        ) : canManage && row.member ? (
          <Select
            value={row.member.conversationScope}
            onValueChange={(v) => handleScopeChange(row.member!, v as ConversationScope)}
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
        ),
    },
    {
      key: "joined",
      header: "Joined",
      cardLabel: "Joined",
      className: "whitespace-nowrap hide-on-md",
      sortValue: (row) => row.joined ?? null,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.joined ? formatDate(row.joined) : "—"}
        </span>
      ),
    },
    // Removing people is the one column a non-manager has no business seeing.
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            align: "right" as const,
            card: "actions" as const,
            cell: (row: TeamRow) =>
              row.role !== "owner" && row.member ? (
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
                        They lose access to this account&apos;s conversations. This can&apos;t be
                        undone.
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
                <span className="text-sm text-muted-foreground">—</span>
              ),
          },
        ]
      : []),
  ]

  const inviteColumns: Column<TeamInvite>[] = [
    {
      key: "email",
      header: "Email",
      card: "title",
      sortValue: (invite) => invite.email,
      cell: (invite) => invite.email,
    },
    {
      key: "role",
      header: "Role",
      card: "meta",
      sortValue: (invite) => invite.role,
      cell: (invite) => <RoleBadge role={invite.role} />,
    },
    {
      key: "scope",
      header: "Inbox access",
      cardLabel: "Inbox access",
      cell: (invite) => (
        <span className="text-sm text-muted-foreground">
          {invite.role === "admin" ? "All conversations" : scopeLabel(invite.conversationScope)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      sortValue: (invite) => invite.status,
      cell: (invite) => <InviteStatusBadge status={invite.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      // Only a live invite can be revoked — an accepted or expired one is
      // history, and the row is kept so "who was invited" stays answerable.
      cell: (invite) =>
        invite.status === "pending" ? (
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
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Settings
          </Link>
        </Button>
        <PageHeader
          title="Team"
          description="Who can sign in to this account, what they can do, and how much of the inbox they see."
          actions={
            canManage ? (
              <Button onClick={() => setShowAdd(true)} disabled={!accountId}>
                <UserPlus className="mr-2 h-4 w-4" /> Add member
              </Button>
            ) : undefined
          }
        />
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
          <DataTable
            columns={memberColumns}
            rows={rows}
            getRowKey={(row) => row.key}
            isLoading={!resolved || loading}
            skeletonRows={3}
            error={
              error ? (
                <EmptyState
                  plain
                  icon={TriangleAlert}
                  title="Couldn’t load the team"
                  description={error}
                />
              ) : undefined
            }
            empty={
              <EmptyState
                plain
                icon={Users}
                title={accountId ? "No team members yet" : "No connected account yet"}
                description={
                  accountId
                    ? "Add a teammate to share this inbox."
                    : "Link a WhatsApp account before inviting teammates."
                }
              />
            }
          />
        </CardContent>
      </Card>

      {canManage && (invites.length > 0 || invitesError) && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              For people without an account here yet. Each expires after seven days and works once,
              for the address it was issued to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={inviteColumns}
              rows={invites}
              getRowKey={(invite) => invite.id}
              isLoading={invitesLoading}
              skeletonRows={2}
              error={
                invitesError ? (
                  <EmptyState
                    plain
                    icon={TriangleAlert}
                    title="Couldn't load the invitations"
                    description={`${invitesError}. Any outstanding invitations are still valid — this is a connection problem, not a revocation.`}
                    action={
                      <Button variant="outline" onClick={fetchInvites}>
                        Try again
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
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
                placeholder="Paste the code you were sent"
                className="w-80 font-mono md:text-xs"
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
            {/* The backend queues an email with this code (TeamService's
                team_invite notification), but the create response carries no
                delivery flag — it can bounce, land in spam, or never send on a
                deployment without mail configured. So the email is the default
                path and the code here is the fallback, not the other way round. */}
            <DialogDescription>
              {createdInvite?.email} doesn&apos;t have an account here yet. We&apos;ve emailed
              them this code. They sign up with that address, then enter it under Settings →
              Team. If the email doesn&apos;t arrive, copy the code and send it to them yourself.
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
            {/* "we'll send them an invitation" read as "we email them", which
                is the expectation that left invitees waiting. Nothing here
                sends mail — an invite is a code this dialog hands back for you
                to pass on, so say that before the address is typed, not after. */}
            <DialogDescription>
              Add someone by email. If they already have an account they&apos;re added straight
              away; if not, you&apos;ll get an invitation code to send them yourself.
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
