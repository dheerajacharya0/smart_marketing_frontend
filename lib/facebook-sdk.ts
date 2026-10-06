import { env } from "@/lib/env"
import {
  parseEmbeddedSignupCancel,
  parseEmbeddedSignupMessage,
  type EmbeddedSignupCancel,
  type EmbeddedSignupSession,
} from "@/lib/embedded-signup-session"

/**
 * Facebook JS SDK loader for Meta Embedded Signup (Feature 1).
 *
 * Loads sdk.js once and resolves `window.FB` after `FB.init`. Requires
 * `NEXT_PUBLIC_FACEBOOK_APP_ID` + `NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID` (Meta App
 * Dashboard values, provided by ops). Until those exist, `embeddedSignupReady`
 * is false and callers should keep the button disabled.
 */

export interface FacebookAuthResponse {
  code?: string
  accessToken?: string
  [key: string]: unknown
}

export interface FacebookLoginResponse {
  authResponse: FacebookAuthResponse | null
  status: string
}

interface FacebookLoginOptions {
  config_id?: string
  response_type?: string
  override_default_response_type?: boolean
  scope?: string
  extras?: Record<string, unknown>
}

interface FacebookSDK {
  init(params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void
  login(cb: (response: FacebookLoginResponse) => void, options?: FacebookLoginOptions): void
}

declare global {
  interface Window {
    FB?: FacebookSDK
    fbAsyncInit?: () => void
  }
}

export const FACEBOOK_APP_ID = env.NEXT_PUBLIC_FACEBOOK_APP_ID
export const FACEBOOK_ES_CONFIG_ID = env.NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID

/** True only when both Meta App Dashboard values are configured. */
export const embeddedSignupReady = Boolean(FACEBOOK_APP_ID && FACEBOOK_ES_CONFIG_ID)

let sdkPromise: Promise<FacebookSDK> | null = null

/** Load + init the FB SDK once. Rejects if the app id is not configured. */
export function loadFacebookSdk(): Promise<FacebookSDK> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Facebook SDK can only load in the browser"))
  }
  if (!FACEBOOK_APP_ID) {
    return Promise.reject(new Error("Facebook App ID is not configured"))
  }
  if (window.FB) return Promise.resolve(window.FB)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<FacebookSDK>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: env.NEXT_PUBLIC_FACEBOOK_GRAPH_VERSION,
      })
      if (window.FB) resolve(window.FB)
      else reject(new Error("Facebook SDK failed to initialize"))
    }

    const existing = document.getElementById("facebook-jssdk")
    if (existing) return
    const script = document.createElement("script")
    script.id = "facebook-jssdk"
    script.src = "https://connect.facebook.net/en_US/sdk.js"
    script.async = true
    script.defer = true
    script.crossOrigin = "anonymous"
    script.onerror = () => reject(new Error("Failed to load the Facebook SDK"))
    document.body.appendChild(script)
  })
  return sdkPromise
}

export interface EmbeddedSignupOutcome extends EmbeddedSignupSession {
  code: string
}

/**
 * "new": a number not on any WhatsApp app — Meta registers it for the API only.
 * "coexistence": a number already on the WhatsApp Business app; the customer
 * scans a QR code in the app and keeps using it alongside the API. Meta refuses
 * a number that is still on an app in "new" mode.
 */
export type EmbeddedSignupMode = "new" | "coexistence"

const FEATURE_TYPE: Record<EmbeddedSignupMode, string> = {
  new: "",
  coexistence: "whatsapp_business_app_onboarding",
}

/** The popup closed without a code; `cancel` is Meta's reason when it sent one. */
export class EmbeddedSignupCancelledError extends Error {
  constructor(readonly cancel: EmbeddedSignupCancel | null) {
    super("Facebook sign-up was cancelled or returned no code")
    this.name = "EmbeddedSignupCancelledError"
  }
}

/**
 * How long to wait after the login callback for the session message. Meta does
 * not order the two; the message usually lands first, and when it is missing
 * the backend falls back to the first number in the WABA. The same wait applies
 * to the CANCEL message that explains an empty callback.
 */
const SESSION_GRACE_MS = 1500

/**
 * Open the Embedded Signup popup and resolve with the `code` to hand the backend,
 * plus the WABA / number the customer picked when Meta reported them.
 * Rejects with EmbeddedSignupCancelledError if the user cancels or no code comes
 * back.
 */
export function launchEmbeddedSignup(mode: EmbeddedSignupMode = "new"): Promise<EmbeddedSignupOutcome> {
  return loadFacebookSdk().then(
    (FB) =>
      new Promise<EmbeddedSignupOutcome>((resolve, reject) => {
        let session: EmbeddedSignupSession = {}
        let cancel: EmbeddedSignupCancel | null = null
        let onSession: (() => void) | null = null
        let onCancel: (() => void) | null = null
        const onMessage = (event: MessageEvent) => {
          const parsed = parseEmbeddedSignupMessage(event.origin, event.data)
          if (parsed) {
            session = parsed
            onSession?.()
            return
          }
          const cancelled = parseEmbeddedSignupCancel(event.origin, event.data)
          if (cancelled) {
            cancel = cancelled
            onCancel?.()
          }
        }
        window.addEventListener("message", onMessage)
        const done = () => window.removeEventListener("message", onMessage)

        FB.login(
          (response) => {
            const code = response?.authResponse?.code
            if (!code) {
              const fail = () => {
                done()
                reject(new EmbeddedSignupCancelledError(cancel))
              }
              if (cancel) {
                fail()
                return
              }
              const timer = window.setTimeout(fail, SESSION_GRACE_MS)
              onCancel = () => {
                window.clearTimeout(timer)
                fail()
              }
              return
            }
            const finish = () => {
              done()
              resolve({ code, ...session })
            }
            if (session.phoneNumberId || session.wabaId) {
              finish()
              return
            }
            const timer = window.setTimeout(finish, SESSION_GRACE_MS)
            onSession = () => {
              window.clearTimeout(timer)
              finish()
            }
          },
          {
            config_id: FACEBOOK_ES_CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {}, featureType: FEATURE_TYPE[mode], sessionInfoVersion: "3" },
          }
        )
      })
  )
}
