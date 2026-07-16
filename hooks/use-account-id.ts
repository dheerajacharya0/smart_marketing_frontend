"use client"

import { useEffect, useState } from "react"
import { getUserDataFromCookie, getActiveWhatsappContext, getFacebookAccounts } from "@/services/api"

// Resolves the current accountId: active WhatsApp context first, falling back
// to the first linked Facebook account (features like contacts/segments don't
// require a registered phone number).
export function useAccountId() {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setResolved(true)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext(user.id)
        if (ctx) {
          setAccountId(ctx.accountId)
          return
        }
        const accountsRes: any = await getFacebookAccounts(user.id)
        const accounts = Array.isArray(accountsRes) ? accountsRes : accountsRes?.data
        const fbAccount = (accounts || []).find((a: any) => a.type === "facebook")
        if (fbAccount) setAccountId(fbAccount.id)
      } catch (err) {
        console.error("Failed to resolve account:", err)
      } finally {
        setResolved(true)
      }
    }
    init()
  }, [])

  return { accountId, resolved }
}
