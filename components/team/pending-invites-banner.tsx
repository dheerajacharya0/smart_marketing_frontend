"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Users } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { useActiveNumber } from "@/hooks/use-active-number"
import { getErrorMessage } from "@/lib/errors"
import { clearPendingInvite, readPendingInvite, sameEmail, type PendingInvite } from "@/lib/pending-invite"
import {
  acceptMyTeamInvite,
  acceptTeamInvite,
  getUserDataFromCookie,
  listMyTeamInvites,
} from "@/services/api"

type Offer = {
  key: string
  inviteId: string | null
  /** Set when joining with a saved code rather than by id. */
  code: string | null
  teamName: string | null
  inviterName: string | null
  role: "admin" | "agent"
}

/**
 * "You've been invited to join X" across the dashboard, so joining a team
 * doesn't depend on finding the email again or knowing where the code goes.
 *
 * Two sources: invites the backend says are addressed to this user's verified
 * email, and a code saved by the /invite page before sign-up (which works even
 * before the address is verified, since the code itself is the proof).
 * Mounted once, in the dashboard layout.
 */
export function PendingInvitesBanner() {
  const queryClient = useQueryClient()
  const { switchToAccount } = useActiveNumber()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [saved, setSaved] = useState<PendingInvite | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    const user = getUserDataFromCookie()
    setUserId(user?.id ?? null)
    setUserEmail(typeof user?.email === "string" ? user.email : null)
    setSaved(readPendingInvite())
  }, [])

  const { data: mine } = useQuery({
    queryKey: ["my-team-invites", userId] as const,
    queryFn: () => listMyTeamInvites(),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    // An older backend without the route: no banner, not an error screen.
    retry: false,
  })

  const offers = useMemo<Offer[]>(() => {
    const list: Offer[] = (Array.isArray(mine) ? mine : []).map((invite) => ({
      key: `id:${invite.id}`,
      inviteId: invite.id,
      code: null,
      teamName: invite.teamName,
      inviterName: invite.inviterName,
      role: invite.role,
    }))
    // A saved code for someone else's address can't be accepted here; leave it
    // saved in case they sign in as that address next.
    if (saved && sameEmail(saved.email, userEmail) && !list.some((o) => o.inviteId === saved.id)) {
      list.push({
        key: `code:${saved.code}`,
        inviteId: saved.id,
        code: saved.code,
        teamName: saved.teamName,
        inviterName: null,
        role: "agent",
      })
    }
    return list.filter((o) => !dismissed.has(o.key))
  }, [mine, saved, userEmail, dismissed])

  if (offers.length === 0) return null

  const join = async (offer: Offer) => {
    setBusyKey(offer.key)
    try {
      const joined = offer.code ? await acceptTeamInvite(offer.code) : await acceptMyTeamInvite(offer.inviteId!)
      if (saved && (offer.code === saved.code || offer.inviteId === saved.id)) {
        clearPendingInvite()
        setSaved(null)
      }
      setDismissed((prev) => new Set(prev).add(offer.key))
      const team = joined.accountName ?? offer.teamName
      let switched = false
      try {
        switched = await switchToAccount(joined.accountId)
      } catch {
        // Joined either way; the number switcher lists the team.
      }
      toast.success(
        switched
          ? `You joined ${team ? `“${team}”` : "the team"} — you're now working in it.`
          : `You joined ${team ? `“${team}”` : "the team"}. It has no WhatsApp number connected yet.`,
        { duration: 6000 },
      )
      void queryClient.invalidateQueries({ queryKey: ["my-team-invites"] })
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't join the team")
      // A spent or revoked code won't start working; stop offering it.
      if (offer.code) {
        clearPendingInvite()
        setSaved(null)
      }
      void queryClient.invalidateQueries({ queryKey: ["my-team-invites"] })
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="divide-y divide-primary/15 border-b border-primary/20 bg-primary/5">
      {offers.map((offer) => (
        <div
          key={offer.key}
          className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2 sm:items-center">
            <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary sm:mt-0" />
            <span>
              {offer.inviterName ? `${offer.inviterName} invited you` : "You've been invited"} to join{" "}
              <span className="font-medium">{offer.teamName ?? "a team"}</span>
              {offer.code ? "" : ` as ${offer.role === "admin" ? "an admin" : "an agent"}`}.
            </span>
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busyKey === offer.key}
              onClick={() => setDismissed((prev) => new Set(prev).add(offer.key))}
            >
              Not now
            </Button>
            <Button size="sm" onClick={() => join(offer)} disabled={busyKey !== null}>
              {busyKey === offer.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join team
            </Button>
          </span>
        </div>
      ))}
    </div>
  )
}
