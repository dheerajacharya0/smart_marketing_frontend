/**
 * Asking the dashboard's one CallCenter to place a call, from anywhere.
 *
 * The call has to outlive the page that started it (an agent calls from a
 * conversation, then opens another one mid-call), so it is owned by the
 * CallCenter mounted in the dashboard layout, and a Call button elsewhere only
 * hands it the target. A window event rather than a context: the button and
 * the center sit in unrelated subtrees, and nothing else needs sharing.
 */

export interface DialTarget {
  phoneNumberId: string
  customerWaId: string
  customerName?: string | null
  conversationId?: string | null
}

const DIAL_EVENT = "wassup:dial"

export function dial(target: DialTarget): void {
  window.dispatchEvent(new CustomEvent<DialTarget>(DIAL_EVENT, { detail: target }))
}

/** Subscribe to dial requests; returns the unsubscribe. */
export function onDial(handler: (target: DialTarget) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<DialTarget>).detail)
  window.addEventListener(DIAL_EVENT, listener)
  return () => window.removeEventListener(DIAL_EVENT, listener)
}
