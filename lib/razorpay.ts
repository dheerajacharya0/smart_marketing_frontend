/**
 * Razorpay Checkout loader.
 *
 * Checkout is a hosted script — it cannot be bundled, and it must not be loaded
 * on every page just in case someone tops up. Inject it on first use and reuse
 * the same promise afterwards.
 *
 * Ground rule for callers: Checkout's success handler means "the gateway
 * accepted the payment", NOT "the wallet moved". Only the server-side Razorpay
 * webhook credits the wallet, so confirm by re-reading GET /billing/wallet.
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

export interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  /** One-time order checkout only. */
  razorpay_order_id?: string
  /** Subscription checkout only. */
  razorpay_subscription_id?: string
  razorpay_signature: string
}

export interface RazorpayCheckoutOptions {
  key: string
  /**
   * One-time order checkout: minor units, exactly as the backend returned it
   * (never multiply again), paired with `order_id`/`currency`. Subscription
   * checkout needs none of these three — the subscription object already
   * carries its price — and takes `subscription_id` instead.
   */
  amount?: number
  currency?: string
  order_id?: string
  subscription_id?: string
  name?: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  handler?: (response: RazorpayHandlerResponse) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
  close: () => void
  on?: (event: string, handler: (payload: unknown) => void) => void
}

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let loader: Promise<RazorpayConstructor> | null = null

/** Resolves to the Razorpay constructor, injecting the script once. */
export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout is browser-only"))
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (loader) return loader

  loader = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    const script = existing ?? document.createElement("script")

    const onLoad = () => {
      if (window.Razorpay) resolve(window.Razorpay)
      else reject(new Error("Razorpay Checkout loaded but did not register"))
    }
    const onError = () => {
      // Let a later attempt retry — a blocked/offline first load shouldn't
      // poison the flow for the rest of the session.
      loader = null
      reject(new Error("Couldn't load the payment window. Check your connection or ad blocker."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })

    if (!existing) {
      script.src = CHECKOUT_SRC
      script.async = true
      document.body.appendChild(script)
    }
  })

  return loader
}
