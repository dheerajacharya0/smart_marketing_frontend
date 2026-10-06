import type { WhatsappBusinessAccountItem } from "@/services/api"

/**
 * One option per number for the guided setup's number step.
 *
 * The step used to offer one option per WhatsApp Business Account, showing
 * only its first number, so a second number in the same WABA could never be
 * picked. Each option is the WABA with `details` set to that number, so the
 * rest of the step keeps reading `item.details` as before.
 *
 * A WABA with no numbers is still one option (it gets the add-a-number form),
 * and an older backend that sends no `numbers` falls back to `details`.
 */
export function wabaNumberOptions(wabas: WhatsappBusinessAccountItem[]): WhatsappBusinessAccountItem[] {
  return wabas.flatMap((waba) => {
    const numbers = Array.isArray(waba.numbers) ? waba.numbers : []
    if (numbers.length === 0) return [{ ...waba, details: waba.details ?? null }]
    return numbers.map((number) => ({ ...waba, details: number }))
  })
}

/** Identifies an option: the WABA and the number within it. */
export function optionKey(item: Pick<WhatsappBusinessAccountItem, "id" | "details"> | null | undefined): string {
  if (!item) return ""
  return `${item.id}:${item.details?.id ?? ""}`
}
