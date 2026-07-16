"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getTeamMembers,
  getUserDataFromCookie,
  type TeamMember,
  type TeamOwner,
  type TeamRole,
} from "@/services/api"

export interface TeamAssignee {
  userId: string
  name: string
  email: string
  role: TeamRole
}

// Loads the account's team (owner + members) and resolves the logged-in
// user's role by matching their id against owner.userId / member.userId.
export function useTeamMembers(accountId: string | null) {
  const [owner, setOwner] = useState<TeamOwner | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    try {
      const res: any = await getTeamMembers(accountId)
      const data: any = res?.owner !== undefined || res?.members !== undefined ? res : res?.data
      setOwner(data?.owner ?? null)
      setMembers(Array.isArray(data?.members) ? data.members : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load team")
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const currentUserId: string | null = getUserDataFromCookie()?.id ?? null

  // Everyone who can be an assignee: owner + members, in one flat list.
  const assignees: TeamAssignee[] = useMemo(() => {
    const list: TeamAssignee[] = []
    if (owner) list.push({ userId: owner.userId, name: owner.name, email: owner.email, role: "owner" })
    for (const m of members) {
      list.push({ userId: m.userId, name: m.name, email: m.email, role: m.role })
    }
    return list
  }, [owner, members])

  const currentRole: TeamRole | null = useMemo(() => {
    if (!currentUserId) return null
    if (owner?.userId === currentUserId) return "owner"
    return members.find((m) => m.userId === currentUserId)?.role ?? null
  }, [owner, members, currentUserId])

  const canManage = currentRole === "owner" || currentRole === "admin"

  const nameFor = useCallback(
    (userId: string | null | undefined): string | null => {
      if (!userId) return null
      return assignees.find((a) => a.userId === userId)?.name ?? null
    },
    [assignees]
  )

  return {
    owner,
    members,
    assignees,
    currentUserId,
    currentRole,
    canManage,
    loading,
    error,
    refetch: fetchTeam,
    nameFor,
  }
}
