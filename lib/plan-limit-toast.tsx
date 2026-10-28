"use client"

import Link from "next/link"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import { isPlanLimitError } from "@/services/api"

/**
 * Toast an action's failure. When the backend blocked it on a plan allowance
 * (PLAN_LIMIT_REACHED) rather than a plain error, the toast carries a "View
 * plans" link instead of just the message — same treatment the calling lock
 * uses (components/calls/call-center.tsx), kept in one place so every
 * capacity-gated action (numbers, broadcasts, drips, flows, API keys, AI
 * drafts) matches it instead of dead-ending on backend text alone.
 */
export function toastActionError(err: unknown, fallback: string) {
  // `|| fallback`, not getErrorMessage's own default: an ApiError with an
  // empty message (backend 403s with none, see services/api.ts) must still
  // fall back to `fallback`, same as every call site this replaces did.
  const message = getErrorMessage(err) || fallback
  if (!isPlanLimitError(err)) {
    toast.error(message)
    return
  }
  toast(
    (t) => (
      <div className="flex flex-col gap-2">
        <span>{message}</span>
        <div className="flex gap-2">
          <Link
            href="/dashboard/settings/plan"
            className="rounded bg-black px-3 py-1 text-sm font-medium text-white"
            onClick={() => toast.dismiss(t.id)}
          >
            View plans
          </Link>
          <button className="rounded px-3 py-1 text-sm text-gray-500" onClick={() => toast.dismiss(t.id)}>
            Dismiss
          </button>
        </div>
      </div>
    ),
    { duration: 10000 },
  )
}
