"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CONSENT_SOURCES } from "@/lib/contact-consent"
import { getErrorMessage } from "@/lib/errors"
import { listContacts, optInContact, type ContactListFilters } from "@/services/api"

/**
 * Record consent for every contact matching the current filter.
 *
 * Opt-in is the gate on this whole product: a campaign can only reach contacts
 * that carry it, and the only way to add it was a per-row toggle — 274 clicks
 * on the account this was built against. That is the reason imported lists sit
 * unusable.
 *
 * It is deliberately not a one-click "mark all opted in". Consent the user does
 * not actually hold is a Meta compliance problem for them and a spam problem
 * for the people on the list, so this asks *where* consent came from and makes
 * them attest to it before anything is written. The chosen source is stored per
 * contact, which is what turns a flipped boolean into a record that can be
 * answered for later.
 *
 * There is no bulk endpoint, so this pages the matching ids and calls the
 * single-contact endpoint with a small concurrency window, reporting partial
 * failure honestly rather than claiming a clean run.
 */

/** Parallel opt-in calls in flight. Enough to be quick, not enough to look like an attack. */
const CONCURRENCY = 4
/** Page size when collecting matching ids. */
const FETCH_PAGE = 200

type Phase = "form" | "running" | "done"

export function BulkConsentDialog({
  open,
  onOpenChange,
  accountId,
  filters,
  matchingTotal,
  scopeLabel,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  /** The list filter this acts on — the same one the table is showing. */
  filters: ContactListFilters
  /** How many contacts that filter matches, for the count shown before running. */
  matchingTotal: number
  /** Plain-language description of the scope, e.g. "not opted in". */
  scopeLabel: string
  onComplete: () => void
}) {
  const [source, setSource] = useState<string>(CONSENT_SOURCES[0].value)
  const [attested, setAttested] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)
  const [firstError, setFirstError] = useState<string | null>(null)
  const cancelled = useRef(false)

  // Re-opening after a run should start clean, not show the last result.
  useEffect(() => {
    if (open) {
      setPhase("form")
      setDone(0)
      setFailed(0)
      setFirstError(null)
      setAttested(false)
      cancelled.current = false
    }
  }, [open])

  const run = async () => {
    setPhase("running")
    cancelled.current = false
    let ok = 0
    let bad = 0
    let firstMessage: string | null = null

    try {
      // Collect ids first. The table only holds one page, and opting in
      // changes what the filter matches, so paging while mutating would skip
      // rows as the result set shifts under us.
      const ids: string[] = []
      for (let offset = 0; offset < matchingTotal; offset += FETCH_PAGE) {
        if (cancelled.current) break
        const page = await listContacts(accountId, {
          ...filters,
          limit: FETCH_PAGE,
          offset,
        })
        ids.push(...page.items.map((c) => c.id))
        if (page.items.length < FETCH_PAGE) break
      }

      let cursor = 0
      const worker = async () => {
        while (cursor < ids.length && !cancelled.current) {
          const id = ids[cursor++]
          try {
            await optInContact(id, accountId, source)
            ok++
          } catch (err) {
            bad++
            if (!firstMessage) firstMessage = getErrorMessage(err) || "Request failed"
          }
          setDone(ok + bad)
          setFailed(bad)
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    } catch (err) {
      // Failure while collecting ids — nothing was written yet unless a
      // previous page already ran, which the counts below still reflect.
      if (!firstMessage) firstMessage = getErrorMessage(err) || "Couldn't read the contact list"
      bad++
    }

    setDone(ok + bad)
    setFailed(bad)
    setFirstError(firstMessage)
    setPhase("done")
    onComplete()
  }

  const total = matchingTotal
  const succeeded = done - failed
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-run stops queuing more writes; the ones already sent stand.
        if (!next && phase === "running") cancelled.current = true
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record consent for {total} contact{total === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            This marks every contact currently matching &ldquo;{scopeLabel}&rdquo; as opted in, so
            campaigns can reach them.
          </DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="consent-source">Where did they agree?</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="consent-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSENT_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {CONSENT_SOURCES.find((s) => s.value === source)?.hint}
              </p>
            </div>

            {/* The warning sits above the confirmation, not in a tooltip: the
                cost of getting this wrong lands on the account, not on us. */}
            <div className="flex gap-2.5 rounded-md border border-warning/40 bg-warning/5 p-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Only do this for people who genuinely agreed to hear from you on WhatsApp. Messaging
                people who didn&apos;t gets your number blocked by Meta and your quality rating cut
                — and it is the hardest thing to undo on this platform.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={attested}
                onCheckedChange={(v) => setAttested(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed">
                I have a record that these {total} contact{total === 1 ? "" : "s"} agreed to be
                messaged on WhatsApp.
              </span>
            </label>
          </div>
        )}

        {phase === "running" && (
          <div className="space-y-3">
            <Progress value={pct} />
            <p className="text-sm text-muted-foreground">
              Recording consent — {done} of {total}
              {failed > 0 && `, ${failed} failed`}
            </p>
            <p className="text-xs text-muted-foreground">
              Closing this stops the remaining ones. Contacts already updated keep their consent.
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              {failed === 0 ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {succeeded} contact{succeeded === 1 ? "" : "s"} can now be messaged.
                </p>
                {failed > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {failed} couldn&apos;t be updated and are still opted out.
                    {firstError ? ` First error: ${firstError}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={run} disabled={!attested || total === 0}>
                Record consent for {total}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button variant="outline" onClick={() => (cancelled.current = true)}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stop
            </Button>
          )}
          {phase === "done" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
