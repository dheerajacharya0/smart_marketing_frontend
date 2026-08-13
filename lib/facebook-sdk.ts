import { env } from "@/lib/env"

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

/**
 * Open the Embedded Signup popup and resolve with the `code` to hand the backend.
 * Rejects if the user cancels or no code comes back.
 */
export function launchEmbeddedSignup(): Promise<string> {
  return loadFacebookSdk().then(
    (FB) =>
      new Promise<string>((resolve, reject) => {
        FB.login(
          (response) => {
            const code = response?.authResponse?.code
            if (code) resolve(code)
            else reject(new Error("Facebook sign-up was cancelled or returned no code"))
          },
          {
            config_id: FACEBOOK_ES_CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
          }
        )
      })
  )
}
