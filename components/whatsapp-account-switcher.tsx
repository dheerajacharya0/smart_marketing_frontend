"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WhatsappContext } from "@/services/api"
import { numberLabel as labelFor } from "@/components/layout/number-switcher"

export function WhatsappAccountSwitcher({
  context,
  availableContexts,
  onSwitch,
}: {
  context: WhatsappContext | null
  availableContexts: WhatsappContext[]
  onSwitch: (phoneNumberId: string) => void
}) {
  if (availableContexts.length <= 1) return null

  return (
    <Select value={context?.phoneNumberId ?? ""} onValueChange={onSwitch}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select number" />
      </SelectTrigger>
      <SelectContent>
        {availableContexts.map((ctx) => (
          <SelectItem key={ctx.phoneNumberId} value={ctx.phoneNumberId}>
            {labelFor(ctx)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
