"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Explain } from "@/components/explain"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney, microsToUnits } from "@/lib/money"
import {
  combineEstimates,
  distinctTemplates,
  expandByOccurrences,
  type CombinedCost,
} from "@/lib/cost"
import { estimateCampaignCost, type CampaignCostEstimate } from "@/services/api"
import { cn } from "@/lib/utils"

/**
 * What a send will cost, shown before the send.
 *
 * One panel and two hooks, shared by every screen that spends money: the
 * campaign composer, drip enrolment, and anywhere else an audience and a
 * template are both known. Screens where they aren't — sending one template to
 * one person from the inbox — get `ConversationChargeNote` instead, which
 * explains the charge without inventing a figure for it.
 *
 * The honesty rules carried by every consumer:
 * - It is an **upper bound**. The wallet is debited per message, keyed by Meta
 *   message id, and only for a status Meta reports as billable — a `service`
 *   category or an explicit `billable: false` is free. Which sends come back
 *   free isn't knowable before they go out, so the estimate prices all of them.
 * - A failed estimate never blocks a send. Missing information is not a reason
 *   to stop a send someone wants.
 * - Nothing is recomputed client-side from a rate we hold. The figure is the
 *   server's or it is absent.
 */

/**
 * Distinct templates priced in one sequence.
 *
 * Each call walks the whole audience server-side, so a 20-step drip is not
 * something to fan out blindly. Past this the panel prices what it can and says
 * so — a partial figure labelled as partial beats a spinner that never resolves.
 */
export const MAX_PRICED_TEMPLATES = 8

interface EstimateParams {
  accountId: string
  templateName: string
  templateLanguage?: string
  /** Mutually exclusive with `segmentId`. Neither prices every opted-in contact. */
  audienceTag?: string
  segmentId?: string
}

function buildParams(params: EstimateParams) {
  return {
    accountId: params.accountId,
    templateName: params.templateName,
    ...(params.templateLanguage ? { templateLanguage: params.templateLanguage } : {}),
    ...(params.audienceTag ? { audienceTag: params.audienceTag } : {}),
    ...(params.segmentId ? { segmentId: params.segmentId } : {}),
  }
}

export interface CostEstimateState {
  cost: CombinedCost | null
  loading: boolean
  error: string | null
}

/** Prices one template against one audience. */
export function useCostEstimate({
  enabled = true,
  ...params
}: EstimateParams & { enabled?: boolean }): CostEstimateState {
  const [state, setState] = React.useState<CostEstimateState>({
    cost: null,
    loading: false,
    error: null,
  })

  const { accountId, templateName, templateLanguage, audienceTag, segmentId } = params

  React.useEffect(() => {
    if (!enabled || !accountId || !templateName) {
      setState({ cost: null, loading: false, error: null })
      return
    }

    // A stale response must never overwrite a fresh one: the audience can change
    // while a slow estimate for the previous one is still in flight, and the
    // wrong price on a send screen is worse than no price.
    let live = true
    setState({ cost: null, loading: true, error: null })

    estimateCampaignCost(
      buildParams({ accountId, templateName, templateLanguage, audienceTag, segmentId }),
    )
      .then((estimate) => {
        if (!live) return
        setState({ cost: combineEstimates([estimate]), loading: false, error: null })
      })
      .catch((err) => {
        if (!live) return
        setState({
          cost: null,
          loading: false,
          error: getErrorMessage(err) || "Couldn't price this send",
        })
      })

    return () => {
      live = false
    }
  }, [enabled, accountId, templateName, templateLanguage, audienceTag, segmentId])

  return state
}

export interface SequenceCostState extends CostEstimateState {
  /** Messages actually priced. Below `totalMessages` when the sequence is long. */
  pricedMessages: number
  totalMessages: number
}

/**
 * Prices a whole sequence of template sends against one audience.
 *
 * The question someone asks before enrolling a tag into a drip is what the drip
 * costs, not what its first message costs — so every step is priced and the
 * results are added. A repeated template is fetched once and counted once per
 * send.
 */
export function useSequenceCost({
  steps,
  enabled = true,
  ...params
}: Omit<EstimateParams, "templateName" | "templateLanguage"> & {
  steps: readonly { templateName: string; templateLanguage?: string }[]
  enabled?: boolean
}): SequenceCostState {
  const [state, setState] = React.useState<SequenceCostState>({
    cost: null,
    loading: false,
    error: null,
    pricedMessages: 0,
    totalMessages: 0,
  })

  const { accountId, audienceTag, segmentId } = params
  // A builder rebuilds its steps array on every render; keying the effect on its
  // identity would re-price on each keystroke.
  const stepsKey = React.useMemo(
    () => steps.map((s) => `${s.templateName}::${s.templateLanguage ?? ""}`).join("|"),
    [steps],
  )

  React.useEffect(() => {
    const parsed = stepsKey
      .split("|")
      .filter(Boolean)
      .map((key) => {
        const [templateName, templateLanguage] = key.split("::")
        return { templateName, ...(templateLanguage ? { templateLanguage } : {}) }
      })
      .filter((step) => step.templateName)

    if (!enabled || !accountId || parsed.length === 0) {
      setState({
        cost: null,
        loading: false,
        error: null,
        pricedMessages: 0,
        totalMessages: parsed.length,
      })
      return
    }

    const distinct = distinctTemplates(parsed)
    const priceable = distinct.slice(0, MAX_PRICED_TEMPLATES)
    const pricedMessages = priceable.reduce((sum, t) => sum + t.occurrences, 0)

    let live = true
    setState({ cost: null, loading: true, error: null, pricedMessages, totalMessages: parsed.length })

    Promise.all(
      priceable.map((template) =>
        estimateCampaignCost(
          buildParams({
            accountId,
            templateName: template.templateName,
            ...(template.templateLanguage ? { templateLanguage: template.templateLanguage } : {}),
            ...(audienceTag ? { audienceTag } : {}),
            ...(segmentId ? { segmentId } : {}),
          }),
        ).then((estimate): { estimate: CampaignCostEstimate; occurrences: number } => ({
          estimate,
          occurrences: template.occurrences,
        })),
      ),
    )
      .then((results) => {
        if (!live) return
        setState({
          cost: combineEstimates(expandByOccurrences(results)),
          loading: false,
          error: null,
          pricedMessages,
          totalMessages: parsed.length,
        })
      })
      .catch((err) => {
        if (!live) return
        setState({
          cost: null,
          loading: false,
          error: getErrorMessage(err) || "Couldn't price this sequence",
          pricedMessages: 0,
          totalMessages: parsed.length,
        })
      })

    return () => {
      live = false
    }
  }, [enabled, accountId, audienceTag, segmentId, stepsKey])

  return state
}

function CategoryCaveat({ categories }: { categories: string[] }) {
  const list =
    categories.length <= 1
      ? categories[0] ?? "the more expensive category"
      : `${categories.slice(0, -1).join(", ")} and ${categories[categories.length - 1]}`

  return (
    <p className="text-xs text-muted-foreground">
      Priced as {list} — we couldn&apos;t find every template locally, so this assumes the more
      expensive <Explain term="template-category">category</Explain>. Meta&apos;s own classification
      is what you&apos;re actually billed on.
    </p>
  )
}

/**
 * The panel: the combined figure, what it excludes, and — when the wallet won't
 * cover it — what happens instead.
 */
export function CostEstimate({
  cost,
  loading,
  error,
  title = "Estimated cost",
  audienceNoun = "recipient",
  incomplete,
  className,
}: CostEstimateState & {
  title?: string
  /** "recipient" for a broadcast, "contact" where an audience is being enrolled. */
  audienceNoun?: string
  /** Copy explaining a partial price, e.g. a sequence longer than we price. */
  incomplete?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-md border p-4 space-y-2", className)}>
      <p className="text-sm font-medium">{title}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Pricing this send…
        </div>
      ) : error ? (
        // Stated, never a blocker. What is missing is the price, not the
        // permission to send.
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : cost ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {cost.recipientCount.toLocaleString()} {audienceNoun}
              {cost.recipientCount === 1 ? "" : "s"}
              {cost.messageCount > 1 ? ` · ${cost.messageCount} messages each` : ""}
            </span>
            <span className="font-mono text-lg tabular-nums">
              up to {formatMoney(microsToUnits(cost.totalMicros), cost.currency)}
            </span>
          </div>

          {/* Never presented as a quote. The charge lands on Meta's delivery
              status, one per message, and only when that status says the
              message was billable — which the estimate cannot know in advance,
              so it prices every recipient. */}
          <p className="text-xs text-muted-foreground">
            An upper bound. Every recipient is priced here, but Meta decides on delivery whether
            each message is billable and some come back free, so the real figure is often lower.
          </p>

          {incomplete ? <p className="text-xs text-muted-foreground">{incomplete}</p> : null}

          {cost.categoryAssumed && <CategoryCaveat categories={cost.categories} />}

          {cost.byCountry.length > 1 && (
            <div className="space-y-0.5 pt-1">
              {cost.byCountry.map((row) => (
                <div
                  key={row.country}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>
                    {row.country} · {row.count.toLocaleString()}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(microsToUnits(row.subtotalMicros), cost.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!cost.sufficientBalance && (
            <p className="text-sm text-destructive">
              Your <Explain term="wallet">wallet</Explain> holds{" "}
              {formatMoney(microsToUnits(cost.walletBalanceMicros), cost.currency)}. Sending may stop
              part-way and resume after you top up.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

const CATEGORY_COST_NOTE: Record<string, string> = {
  MARKETING: " Marketing is the most expensive category.",
  UTILITY: " Utility costs less than marketing.",
  AUTHENTICATION: " Authentication is priced separately from marketing.",
}

/**
 * The charge behind a single template send, where there is no audience to price.
 *
 * One template to one person can't go through `/billing/estimate` — that
 * endpoint prices an audience — and deriving a figure from a rate we hold
 * locally would be inventing one. So this says what will be charged and what
 * actually makes it free, and leaves the number to the wallet.
 *
 * The correction worth keeping: an inbound message from the contact does **not**
 * make a template free. It opens a free *service* window, and the wallet is
 * debited per message on the category in Meta's own delivery status — only
 * `service` (and an explicit `billable: false`) costs nothing.
 */
export function ConversationChargeNote({
  category,
  className,
}: {
  /** The template's Meta category, when known. */
  category?: string
  className?: string
}) {
  const note = category ? CATEGORY_COST_NOTE[category.toUpperCase()] ?? "" : ""
  const named = category ? category.toLowerCase() : null

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Charged as {named ? `a ${named} message` : "its template category"}, at your rate for this
      contact&apos;s country.{note} A reply from them doesn&apos;t make it free — an incoming
      message opens a free service <Explain term="conversation">conversation</Explain>, and
      templates are priced separately from it.
    </p>
  )
}

/**
 * A template's pricing category as a chip, for step lists where the cost
 * difference between one step and the next is the thing worth seeing.
 */
export function TemplateCategoryBadge({
  category,
  className,
}: {
  category?: string
  className?: string
}) {
  if (!category) return null
  const label = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()

  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      {label}
      <Explain term="template-category" />
    </Badge>
  )
}
