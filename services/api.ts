import Cookies from "js-cookie" // If you use js-cookie, otherwise use document.cookie
import { AUTH_ENDPOINTS, LINKS_ENDPOINTS, CONVERSIONS_ENDPOINTS, API_KEYS_ENDPOINTS, FACEBOOK_ENDPOINTS, WHATSAPP_ENDPOINTS, CHAT_ENDPOINTS, AUTOMATION_ENDPOINTS, CONTACTS_ENDPOINTS, CAMPAIGNS_ENDPOINTS, ANALYTICS_ENDPOINTS, SEGMENTS_ENDPOINTS, FLOWS_ENDPOINTS, TEAM_ENDPOINTS, DRIPS_ENDPOINTS, ALERTS_ENDPOINTS, BILLING_ENDPOINTS } from "@/config/api-config"
import type { TemplateComponent } from "@/lib/whatsapp-template"

export interface WhatsappContext {
  accountId: string
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
}

const ACTIVE_PHONE_NUMBER_KEY = "activeWhatsappPhoneNumberId"

/**
 * NOT the shape of our backend's responses. The backend has no global response
 * interceptor — every controller returns its raw service result, never
 * `{ success, data }`. Kept only because some endpoints proxy Meta's Graph API,
 * whose own envelope really is `{ data: [...] }`. Reach for it only when the
 * body genuinely comes from Meta; for our own routes the payload is top-level.
 */
export interface MetaEnvelope<T> {
  data: T
}

/**
 * `POST /auth/login` response body. The JWT is NOT here — it is set as an
 * httpOnly cookie by the backend, so the body carries only the user.
 */
export interface LoginResponse {
  user: AuthUser
}

/**
 * The authenticated user as the backend actually returns it. The `User` entity
 * has no role column and auth never sends one, so there is deliberately no
 * `role` field here — anything reading `user.role` is reading undefined.
 */
export interface AuthUser {
  id: string
  name?: string
  email: string
  accounts: Array<Record<string, unknown>>
}

/** `POST /auth/signup` — the controller returns only these three fields. */
export interface SignupResponse {
  id: string
  name: string
  email: string
}

// Error handling
export class ApiError extends Error {
  status: number
  /**
   * Stable machine code from the backend error body (e.g. FACEBOOK_NOT_LINKED,
   * OUTSIDE_24H_WINDOW). Branch on this, never on `message` — message text is
   * human-facing and changes freely. Undefined for errors that carry no code.
   */
  code?: string
  /** Meta's numeric error code, when the failure originated at the Graph API. */
  metaCode?: number

  constructor(message: string, status: number, code?: string, metaCode?: number) {
    super(message)
    this.status = status
    this.code = code
    this.metaCode = metaCode
    this.name = "ApiError"
  }
}

/**
 * Every "you must reconnect Facebook" situation the backend can report — an
 * account that was never linked, a token that expired, or a token missing a
 * WhatsApp permission — collapses to these two codes. UI shows one reconnect
 * prompt for either.
 */
export function isFacebookReconnectError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "FACEBOOK_NOT_LINKED" ||
      error.code === "FACEBOOK_PERMISSION_MISSING")
  )
}

/**
 * True when a send failed because the contact's 24-hour window is closed.
 * Matches on the code in every shape the backend can send it — the stable
 * string, or Meta's numeric 131047 in either `code` or `metaCode`. Never match
 * on the message text; it is prose and it changes.
 */
export const OUTSIDE_24H_WINDOW_META_CODE = 131047

export function isOutside24hWindow(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return (
    error.code === "OUTSIDE_24H_WINDOW" ||
    error.code === "outside_24h_window" ||
    error.code === String(OUTSIDE_24H_WINDOW_META_CODE) ||
    error.metaCode === OUTSIDE_24H_WINDOW_META_CODE
  )
}

/**
 * 403 — authenticated but not allowed. Distinct from 401 (no/expired session):
 * a 403 must NOT bounce the user to login, it means this account lacks the role.
 * `POST /billing/credit` is the common one: admin-only since the top-up guard.
 */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

/**
 * 503 — the feature exists but its dependency isn't configured on the server.
 * `POST /billing/topup/order` throws this when RAZORPAY_KEY_ID/SECRET are unset.
 * Nothing the user can do, so don't invite a retry.
 */
export function isServiceUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503
}

// Auth routes that legitimately return 401 for their own reasons (bad
// credentials, unverified email) — a 401 here is not an expired session.
const AUTH_URL_PATTERN = /\/auth\/(login|signup|forgot-password|reset-password|verify-email|resend-verification)/

/** Pages where redirecting to /login on a 401 would loop or make no sense. */
const AUTH_PAGE_PATTERN = /^\/(login|signup|forgot-password|reset-password|verify-email)/

let redirectingToLogin = false

/** On an expired/invalid session, clear the token once and send the user to login. */
function handleUnauthorized(requestUrl: string): void {
  if (typeof window === "undefined") return
  if (AUTH_URL_PATTERN.test(requestUrl)) return
  if (AUTH_PAGE_PATTERN.test(window.location.pathname)) return
  if (redirectingToLogin) return
  redirectingToLogin = true

  // The httpOnly token cannot be cleared from JS; it is already invalid (that is
  // why we got 401) and the backend rejects it. Clear the UI session marker and
  // bounce to login, which overwrites the stale cookie on the next sign-in.
  Cookies.remove("userData")
  window.location.href = "/login?expired=1"
}

/** Event name a 402 (wallet exhausted) broadcasts; a provider opens the top-up UI. */
export const WALLET_EXHAUSTED_EVENT = "wallet:exhausted"

/**
 * A send blocked by an empty wallet returns 402 anywhere. Broadcast it so a
 * single global listener can open the top-up flow, instead of every call site
 * handling it. The ApiError still throws so the caller's own catch runs too.
 */
function notifyWalletExhausted(message: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(WALLET_EXHAUSTED_EVENT, { detail: { message } }))
}

/**
 * Base fetch wrapper. Resolves to the response body exactly as the backend sent
 * it — there is no wrapper to unpack.
 */
/** Default hard timeout for any request; a hung fetch would otherwise spin forever. */
const REQUEST_TIMEOUT_MS = 20_000

/**
 * Read a response body without assuming JSON. The backend has a byte endpoint
 * (`media/.../download`) and returns HTML on 5xx/proxy errors, so a blanket
 * `.json()` throws and masks the real status. Parse only when the content-type
 * says JSON and there is a body (not 204); otherwise return null.
 */
async function parseBody(response: Response): Promise<any> {
  if (response.status === 204) return null
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  // Abort a hung request after REQUEST_TIMEOUT_MS. Respect a caller-supplied
  // signal too by not overwriting it when one is passed.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // Default headers. A FormData body must NOT carry an explicit Content-Type:
    // the browser has to set it itself so it can append the multipart boundary,
    // and forcing application/json here makes the server parse a file upload as
    // JSON and reject it.
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    }

    // Auth rides entirely on the httpOnly access_token cookie: `credentials:
    // "include"` sends it on this cross-site request. JS never holds the token,
    // so there is no Authorization header to attach.
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      signal: options.signal ?? controller.signal,
    })

    // Parse the body only when it is JSON with content (guards byte/HTML/204).
    const data = await parseBody(response)
    // Handle API errors
    if (!response.ok) {
      // Central session recovery: a 401 from any guarded route means the JWT is
      // missing/expired (the backend signs 1-day tokens; the authToken cookie
      // lingers up to 7). Clear it and bounce to login so the user isn't
      // stranded with silent failures. Excludes the auth endpoints themselves —
      // a wrong-password login also 401s and must surface its own error — and
      // guards against a redirect loop when already on an auth page.
      // A Facebook reconnect error also comes back as 401 (expired/invalid
      // Graph token), but it must NOT clear the app session — only the Facebook
      // link is stale, the user's JWT is fine. Distinguish by the stable code.
      const isFacebookAuth =
        data?.code === "FACEBOOK_NOT_LINKED" ||
        data?.code === "FACEBOOK_PERMISSION_MISSING"
      if (response.status === 401 && !isFacebookAuth) {
        handleUnauthorized(url)
      }
      // Meta/Graph API errors are sometimes proxied through as-is (error_user_msg/error_user_title),
      // sometimes wrapped under data.error or data.message — prefer the most human-readable field.
      const metaError = data?.error?.error_user_msg
        ? data.error
        : data?.error_user_msg
          ? data
          : null
      // NestJS validation errors come back as `message: string[]` — join them so
      // the user sees text, not `[object Object]`. Fall back to the HTTP status
      // line when the body was non-JSON (HTML 5xx, empty).
      const rawMessage =
        metaError?.error_user_msg ||
        metaError?.error_user_title ||
        data?.message ||
        data?.error?.message
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(", ")
        : rawMessage || response.statusText || "An error occurred"
      // Validation failures come back as `message: string[]`, one entry per
      // offending property ("property userId should not exist"). Joined prose is
      // fine for the user but useless when debugging, so in dev log the raw
      // array next to the request that caused it — the field name is right there.
      if (process.env.NODE_ENV !== "production" && response.status === 400 && Array.isArray(rawMessage)) {
        console.error(
          `[api] 400 validation failure — ${options.method ?? "GET"} ${url}`,
          rawMessage
        )
      }
      // 403 is "your role can't do this", not "log in again" — handleUnauthorized
      // above deliberately does not fire. Give it a message when the body has none.
      if (response.status === 403 && !rawMessage) {
        throw new ApiError(
          "You don't have permission to do that on this account.",
          403,
          data?.code,
          data?.metaCode
        )
      }
      // A 402 = wallet exhausted on a send. Broadcast globally so a single
      // listener opens the top-up UI, in addition to the thrown error.
      if (response.status === 402) {
        notifyWalletExhausted(message)
      }
      // Backend now attaches a stable `code` on mapped Facebook/Graph errors
      // (FACEBOOK_NOT_LINKED, OUTSIDE_24H_WINDOW, …). `metaCode` is Meta's raw
      // numeric code when the failure came from Graph. Both are optional.
      throw new ApiError(message, response.status, data?.code, data?.metaCode)
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // An AbortError here is our own timeout firing (or a caller cancel).
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408)
    }

    // Handle network errors
    throw new ApiError(error instanceof Error ? error.message : "Network error", 500)
  } finally {
    clearTimeout(timeoutId)
  }
}

// Auth services

/** Resolves to the signed-in user, not the whole login payload. */
export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest<LoginResponse>(AUTH_ENDPOINTS.LOGIN, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (response?.user) {
    // The JWT is set by the backend as an httpOnly cookie (not JS-readable).
    // We only persist non-sensitive userData for UI/session-presence checks.
    Cookies.set("userData", JSON.stringify(response.user), { expires: 7 });
    return response.user;
  } else {
    throw new Error("Login failed");
  }
}

export async function signup(name: string, email: string, password: string): Promise<SignupResponse> {
  const response = await apiRequest<SignupResponse>(AUTH_ENDPOINTS.SIGNUP, {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })

  if (response.id) {
    localStorage.setItem("userData", JSON.stringify(response))
    return response
  } else {
    throw new Error("Signup failed")
  }
}

// Request a password-reset email. Backend always returns 200 (never reveals
// whether the email exists) — we surface a generic success either way.
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return { message: response?.message || "If that email exists, a reset link is on its way." }
}

// Complete a password reset with the token from the emailed link.
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.RESET_PASSWORD, {
    method: "POST",
    body: JSON.stringify({ token, password }),
  })
  return { message: response?.message || "Password updated. You can now sign in." }
}

// Confirm an email address via the token in the verification link.
export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.VERIFY_EMAIL, {
    method: "POST",
    body: JSON.stringify({ token }),
  })
  return { message: response?.message || "Email verified." }
}

// Re-send the verification email to an address that hasn't confirmed yet.
export async function resendVerification(email: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.RESEND_VERIFICATION, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return { message: response?.message || "Verification email sent." }
}

export async function logout(): Promise<void> {
  // The httpOnly access_token cookie is not JS-readable, so only the server can
  // clear it — hit the logout endpoint first. Best-effort: even if it fails
  // (offline, already-expired session), still clear the client-side state below.
  try {
    await apiRequest<DeleteResult>(AUTH_ENDPOINTS.LOGOUT, { method: "POST" })
  } catch {
    // ignore — clearing local state is what matters for the user
  }

  // The httpOnly token was cleared by the backend logout above. Drop the
  // client-side userData marker so isAuthenticated() reflects the logout.
  Cookies.remove("userData")
}

// The real session lives in the httpOnly access_token cookie, which JS cannot
// read. We use the presence of the userData cookie (written only by a real
// login / Facebook connect, never by signup) as the client-visible session
// marker. A stale marker still yields a clean 401 -> login redirect via
// handleUnauthorized, so this only gates UI, never actual authorization.
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  return !!Cookies.get("userData")
}

/** The user stored at login. Shape mirrors what `POST /auth/login` returned. */
export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null

  const userData = Cookies.get("userData")
  if (!userData) return null
  try {
    return JSON.parse(userData) as AuthUser
  } catch {
    return null
  }
}

export async function getFacebookLoginUrl(): Promise<string> {
  const response = await apiRequest<{ url: string }>(AUTH_ENDPOINTS.FACEBOOK_LOGIN_URL)
  if (!response.url) {
    throw new Error("Failed to fetch Facebook login URL")
  }
  return response.url
}

// --- Meta Embedded Signup -------------------------------------------------
export interface EmbeddedSignupResult {
  accountId: string
  wabaId: string
  phoneNumberId: string
  status: string
  registered: boolean
  registerError?: string
}

/**
 * Hand the backend the single `code` from the Embedded Signup popup. The backend
 * does token exchange, WABA discovery, phone register, and app subscribe. A 400
 * means the user granted no WABA or has no phone number yet — surface `message`.
 */
export async function submitEmbeddedSignup(code: string): Promise<EmbeddedSignupResult> {
  return apiRequest<EmbeddedSignupResult>(AUTH_ENDPOINTS.EMBEDDED_SIGNUP, {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

// --- Billing / prepaid wallet ---------------------------------------------
export interface Wallet {
  accountId: string
  currency: string
  /** Integer-string micros (1 unit = 1,000,000 micros); use for exact math. */
  balanceMicros: string
  /** Decimal balance in `currency` units — display this. */
  balance: number
}

/**
 * Which feature caused an outbound message. Captured at send time on the event
 * row and copied onto the ledger entry when the status webhook debits, because
 * the webhook itself only knows a wamid and a pricing category.
 *
 * Attribution is only ever recorded going forward — a charge that was written
 * before attribution existed stays un-sourced permanently, and comes back from
 * the usage endpoint as `unattributed`.
 */
export type MessageSource =
  | "manual"
  | "campaign"
  | "drip"
  | "automation"
  | "flow"
  | "system"
  | "api"

export interface BillingEntry {
  id: string
  type: "credit" | "debit"
  amount: number
  balanceAfter: number
  currency: string
  reason: string
  category: string | null
  country: string | null
  /** Null on credits (a top-up has no feature behind it) and on pre-attribution debits. */
  source: MessageSource | null
  createdAt: string
}

export interface BillingEntriesResponse {
  total: number
  entries: BillingEntry[]
}

/** One feature's slice of spend. `source` is a MessageSource or `"unattributed"`. */
export interface BillingUsageRow {
  source: MessageSource | "unattributed"
  messages: number
  /** What we charged, in currency units. */
  charged: number
  /** Integer-string micros of `charged`; use for exact math. */
  chargedMicros: string
  /** What Meta's invoice cost us, tax included. */
  cost: number
  /** `charged - cost`. */
  margin: number
}

/**
 * Spend broken down by the feature that caused it. Debits only — a credit has no
 * source — so `totalCharged` here is money spent on messages, never the wallet
 * balance, and it will not match a top-up total.
 */
export interface BillingUsageSummary {
  accountId: string
  currency: string
  from: string | null
  to: string | null
  totalCharged: number
  totalMessages: number
  /** Server-sorted by spend, highest first. */
  bySource: BillingUsageRow[]
}

export async function getWallet(accountId: string): Promise<Wallet> {
  return apiRequest<Wallet>(BILLING_ENDPOINTS.WALLET(accountId))
}

export async function getBillingEntries(
  accountId: string,
  limit = 50,
  offset = 0
): Promise<BillingEntriesResponse> {
  return apiRequest<BillingEntriesResponse>(BILLING_ENDPOINTS.ENTRIES(accountId, limit, offset))
}

/**
 * What we charge over Meta's cost, and where that number comes from.
 *
 * All three are returned because the effective rate alone can't say whether an
 * account is on a negotiated rate or just following the default — which is the
 * actual question when someone asks why a customer pays what they pay.
 */
export interface MarkupSettings {
  accountId: string
  /** What this account is billed at right now. */
  effectivePercent: number
  /** Null = following the global default rather than a negotiated rate. */
  accountPercent: number | null
  globalPercent: number
  /** The deployment's env floor — what clearing the global setting falls back to. */
  envDefaultPercent: number
  /** Unreclaimable GST on Meta's invoice; compounds into the per-message price as cost. */
  inputTaxPercent: number
}

export async function getMarkupSettings(accountId: string): Promise<MarkupSettings> {
  return apiRequest<MarkupSettings>(BILLING_ENDPOINTS.MARKUP(accountId))
}

/**
 * Sets this account's override. **Platform admins only — a 403 here means the
 * signed-in user isn't one**, not that the session expired.
 *
 * `null` clears the override and puts the account back on the global default,
 * which is deliberately different from `0` (a negotiated at-cost rate). Takes
 * effect on the next charge; there's no cache to wait on.
 */
export async function setAccountMarkup(
  accountId: string,
  markupPercent: number | null
): Promise<MarkupSettings> {
  return apiRequest<MarkupSettings>(BILLING_ENDPOINTS.SET_MARKUP, {
    method: "PATCH",
    body: JSON.stringify({ accountId, markupPercent }),
  })
}

/** Platform admins only. Moves every account that has no override of its own. */
export async function setGlobalMarkup(
  markupPercent: number
): Promise<{ globalPercent: number; previousPercent: number; envDefaultPercent: number }> {
  return apiRequest<{
    globalPercent: number
    previousPercent: number
    envDefaultPercent: number
  }>(BILLING_ENDPOINTS.SET_GLOBAL_MARKUP, {
    method: "PATCH",
    body: JSON.stringify({ markupPercent }),
  })
}

/**
 * Spend per feature. `from`/`to` are ISO strings; the range is half-open
 * (`createdAt >= from`, `< to`), so a day boundary belongs to one side only.
 */
export async function getBillingUsage(
  accountId: string,
  from?: string,
  to?: string
): Promise<BillingUsageSummary> {
  return apiRequest<BillingUsageSummary>(BILLING_ENDPOINTS.USAGE(accountId, from, to))
}

/**
 * Admin-only (403 for a normal user): credits a wallet with no payment behind
 * it. Refunds and reconciliation only — customer top-ups go through
 * `createTopupOrder` + Razorpay Checkout. Do not call this from a customer-facing
 * "add balance" button; that was free money before the guard landed.
 */
export async function creditWallet(
  accountId: string,
  amount: number,
  reason?: string
): Promise<Wallet> {
  return apiRequest<Wallet>(BILLING_ENDPOINTS.CREDIT, {
    method: "POST",
    body: JSON.stringify({ accountId, amount, reason }),
  })
}

/** What the backend hands back to open Razorpay Checkout with. */
export interface TopupOrder {
  /** Our row id (also the Razorpay receipt). */
  topupId: string
  orderId: string
  keyId: string
  /**
   * MINOR units (paise) — this is what Razorpay Checkout must be given. Passing
   * `amount` instead undercharges by 100x.
   */
  amountMinorUnits: number
  /** Whole currency units, for display only. Never send this to Checkout. */
  amount: number
  currency: string
  accountId: string
}

/**
 * Step 1 of a customer top-up: create the Razorpay order. `amount` is in major
 * currency units (>= 1) — the backend converts to minor units in the response.
 * The wallet is NOT credited here; a server-side Razorpay webhook does that.
 */
export async function createTopupOrder(accountId: string, amount: number): Promise<TopupOrder> {
  return apiRequest<TopupOrder>(BILLING_ENDPOINTS.TOPUP_ORDER, {
    method: "POST",
    body: JSON.stringify({ accountId, amount }),
  })
}

/** A row of payment history. `status` flips created -> paid when the webhook lands. */
export interface TopupOrderRecord {
  id: string
  provider?: string
  orderId?: string
  paymentId?: string | null
  /** WHOLE currency units — the backend already converted from micros. */
  amount: number
  currency: string
  status: "created" | "paid" | "failed" | string
  createdAt: string
}

export async function listTopupOrders(
  accountId: string,
  limit?: number
): Promise<TopupOrderRecord[]> {
  const res = await apiRequest<TopupOrderRecord[] | { orders: TopupOrderRecord[] }>(
    BILLING_ENDPOINTS.TOPUP_ORDERS(accountId, limit)
  )
  return Array.isArray(res) ? res : (res?.orders ?? [])
}

// Facebook-connect exchanges the OAuth code for a linked Account, not an app
// access_token — app auth only ever comes from loginWithEmail. Requires an
// existing session (the httpOnly cookie is sent automatically); the backend 401s
// otherwise rather than silently creating/merging an account by email. Store the
// returned user under userData.
export async function handleFacebookCallback(code: string) {
  try {
    const response: any = await apiRequest<any>(AUTH_ENDPOINTS.FACEBOOK_CALLBACK, {
      method: "POST",
      body: JSON.stringify({ code }),
    })

    if (!response.id) {
      throw new Error("No user received from Facebook login")
    }

    Cookies.set("userData", JSON.stringify(response), { expires: 7 })

    return response
  } catch (error) {
    console.error("Facebook login failed:", error)
    throw error
  }
}

export function getUserDataFromCookie() {
  // signup() only writes userData to localStorage, not the cookie, so fall
  // back to it — otherwise a signed-up-but-never-logged-in session looks
  // unauthenticated to every caller that reads this (chat history, etc).
  const userData = Cookies.get("userData") || (typeof window !== "undefined" ? localStorage.getItem("userData") : null);
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

// A linked Facebook account as returned by GET /auth/facebook-accounts.
export interface FacebookAccount {
  id: string
  facebookId?: string
  name?: string
  email?: string
  status?: string
  whatsappBusinessDetails?: { wabaId: string; phoneNumberId: string } | null
  type: "facebook"
  /** True when the stored FB token is dead and the account must be re-linked. */
  needsReauth?: boolean
  /** ISO date the FB token expires (~60 days out), or null if unknown. */
  tokenExpiresAt?: string | null
}

// No userId argument by design: the session cookie identifies the user, and
// sending one alongside it is the IDOR the backend just closed.
export async function getFacebookAccounts(): Promise<FacebookAccount[]> {
  return apiRequest<FacebookAccount[]>(FACEBOOK_ENDPOINTS.GET_ACCOUNTS())
}

// Proxies Meta's Graph API — the response is Meta's own envelope, shape varies
// by Graph version, so it stays loosely typed.
export async function getFacebookBusinessManagers(accountId: string): Promise<unknown> {
  return apiRequest<unknown>(FACEBOOK_ENDPOINTS.GET_BUSINESS_MANAGERS(accountId));
}



// SetBusinessDetailsDto declares exactly these two properties and the backend
// rejects anything else with a 400 — no index signature, or a stray field ships
// a request that fails validation instead of being dropped.
export async function setWhatsappBusinessDetails(details: {
  accountId: string
  accountDetails: Record<string, unknown>
}): Promise<unknown> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.SET_BUSINESS_DETAILS, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

// Meta's WhatsApp Business Account, enriched by the backend with a `details`
// phone-number object. Loose because it mirrors Meta's Graph response.
export interface WhatsappBusinessAccountItem {
  id: string
  name?: string
  details?: {
    id?: string
    display_phone_number?: string
    verified_name?: string
    code_verification_status?: string
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

// Returns Meta's `{ data: [...] }` envelope (consumers destructure `{ data }`).
export async function getWhatsappBusinessAccount(
  wabaId: string
): Promise<MetaEnvelope<WhatsappBusinessAccountItem[]>> {
  return apiRequest<MetaEnvelope<WhatsappBusinessAccountItem[]>>(
    FACEBOOK_ENDPOINTS.GET_WHATSAPP_BUSINESS_ACCOUNT(wabaId)
  )
}

export async function syncBusiness(accountId?: string): Promise<unknown> {
  return apiRequest<unknown>(FACEBOOK_ENDPOINTS.SYNC_BUSINESS(accountId), {
    method: "POST",
  })
}

// Meta's message-send response. text/media/interactive sends are wrapped by the
// backend's buildSendResult, which adds messageId/deliveryStatus/session on top
// of Meta's fields; sendTemplate returns Meta's fields raw. All the extras are
// optional so this one type covers both paths.
export interface WhatsappSendResult {
  messaging_product?: string
  contacts?: { input: string; wa_id: string }[]
  messages?: { id: string; message_status?: string }[]
  messageId?: string | null
  deliveryStatus?: "accepted"
  session?: { open: boolean; lastInboundAt: string | null; expiresAt: string | null }
}

// A registered phone number row as stored by the backend.
export interface WhatsappPhoneNumber {
  id: string
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string | null
  verifiedName?: string | null
  status: string
  createdAt?: string
  // Meta number-health fields, populated after the first quality webhook.
  qualityRating?: string | null
  messagingTier?: string | null
  qualityUpdatedAt?: string | null
}

// Meta media metadata (GET /{mediaId}); loose — mirrors Meta's Graph response.
export interface WhatsappMediaMetadata {
  id?: string
  url?: string
  mime_type?: string
  sha256?: string
  file_size?: number
  messaging_product?: string
  [key: string]: unknown
}

// A Meta message template (list/create/update responses); loose — mirrors Meta.
export interface WhatsappTemplate {
  id?: string
  name: string
  status?: string
  category?: string
  language?: string
  components?: TemplateComponent[]
  parameter_format?: "POSITIONAL" | "NAMED"
  [key: string]: unknown
}

export async function addWhatsappPhoneNumber(details: {
  accountId: string
  wabaId: string
  phoneNumber: string
  verifiedName: string
  cc?: string
}): Promise<{ id?: string; data?: { id?: string } }> {
  return apiRequest<{ id?: string; data?: { id?: string } }>(WHATSAPP_ENDPOINTS.ADD_PHONE_NUMBER, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listWhatsappPhoneNumbers(accountId: string): Promise<WhatsappPhoneNumber[]> {
  return apiRequest<WhatsappPhoneNumber[]>(WHATSAPP_ENDPOINTS.LIST_PHONE_NUMBERS(accountId))
}

// Meta returns a success acknowledgement; the result is not consumed beyond
// throw-on-error, so it stays loosely typed.
export async function requestWhatsappVerificationCode(details: {
  accountId: string
  phoneNumberId: string
  codeMethod: "SMS" | "VOICE"
  language?: string
}): Promise<unknown> {
  return apiRequest<unknown>(WHATSAPP_ENDPOINTS.REQUEST_CODE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function verifyWhatsappCode(details: {
  accountId: string
  phoneNumberId: string
  code: string
}): Promise<unknown> {
  return apiRequest<unknown>(WHATSAPP_ENDPOINTS.VERIFY_CODE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function registerWhatsappPhone(details: {
  accountId: string
  wabaId: string
  phoneNumberId: string
  pin: string
}): Promise<unknown> {
  return apiRequest<unknown>(WHATSAPP_ENDPOINTS.REGISTER, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function subscribeWhatsappWaba(details: {
  accountId: string
  wabaId: string
}): Promise<unknown> {
  return apiRequest<unknown>(WHATSAPP_ENDPOINTS.SUBSCRIBE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

/**
 * State of the 24-hour customer-service window for one recipient. Meta only
 * allows free-form messages inside it; outside, an approved template is the only
 * way through. Check this before enabling the composer so the user learns the
 * rule from a disabled input, not a rejected send.
 */
export interface SessionWindow {
  open: boolean
  lastInboundAt: string | null
  expiresAt: string | null
}

export async function getSessionWindow(
  accountId: string,
  phoneNumberId: string,
  to: string
): Promise<SessionWindow> {
  return apiRequest<SessionWindow>(WHATSAPP_ENDPOINTS.SESSION_WINDOW(accountId, phoneNumberId, to))
}

export async function sendWhatsappMessage(details: {
  accountId: string
  phoneNumberId: string
  to: string
  message: string
}): Promise<WhatsappSendResult> {
  return apiRequest<WhatsappSendResult>(WHATSAPP_ENDPOINTS.SEND, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export type WhatsappMediaType = "image" | "video" | "audio" | "document" | "sticker"

/**
 * Uploads a file to the Cloud API and returns its media id.
 *
 * The id is valid for **30 days** and is scoped to the phone number it was
 * uploaded for, so don't cache one across numbers. Body is FormData on purpose
 * — `apiRequest` leaves the Content-Type off so the browser can set the
 * multipart boundary.
 *
 * Size and type are enforced server-side (which sniffs the bytes rather than
 * trusting `File.type`); `lib/media-upload.ts` mirrors the rules so an
 * over-limit file can be refused before the upload starts.
 */
export async function uploadWhatsappMedia(details: {
  accountId: string
  phoneNumberId: string
  type: WhatsappMediaType
  file: File
}): Promise<{ id: string }> {
  const form = new FormData()
  form.append("file", details.file)
  form.append("accountId", details.accountId)
  form.append("phoneNumberId", details.phoneNumberId)
  form.append("type", details.type)
  return apiRequest<{ id: string }>(WHATSAPP_ENDPOINTS.UPLOAD_MEDIA, {
    method: "POST",
    body: form,
  })
}

// Either link (public URL) or mediaId — exactly one. caption only for
// image/video/document; filename only for document.
export async function sendWhatsappMedia(details: {
  accountId: string
  phoneNumberId: string
  to: string
  type: WhatsappMediaType
  link?: string
  mediaId?: string
  caption?: string
  filename?: string
}): Promise<WhatsappSendResult> {
  return apiRequest<WhatsappSendResult>(WHATSAPP_ENDPOINTS.SEND_MEDIA, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export interface InteractiveButtonsInput {
  kind: "buttons"
  bodyText: string
  headerText?: string
  footerText?: string
  buttons: { id: string; title: string }[]
}

export interface InteractiveListInput {
  kind: "list"
  bodyText: string
  headerText?: string
  footerText?: string
  buttonText: string
  sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
}

export type InteractiveInput = InteractiveButtonsInput | InteractiveListInput

export async function sendWhatsappInteractive(details: {
  accountId: string
  phoneNumberId: string
  to: string
} & InteractiveInput): Promise<WhatsappSendResult> {
  return apiRequest<WhatsappSendResult>(WHATSAPP_ENDPOINTS.SEND_INTERACTIVE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function getWhatsappMediaMetadata(
  mediaId: string,
  accountId: string
): Promise<WhatsappMediaMetadata> {
  return apiRequest<WhatsappMediaMetadata>(WHATSAPP_ENDPOINTS.MEDIA_METADATA(mediaId, accountId))
}

// Raw media bytes via the authenticated download proxy — the metadata `url`
// and payload URLs are Meta lookaside links the browser can't fetch directly.
// Not routed through apiRequest because the response is binary, not JSON; auth
// rides on the httpOnly cookie via credentials: "include".
export async function fetchWhatsappMediaBlob(mediaId: string, accountId: string): Promise<Blob> {
  const response = await fetch(WHATSAPP_ENDPOINTS.MEDIA_DOWNLOAD(mediaId, accountId), {
    credentials: "include",
  })
  if (!response.ok) {
    throw new ApiError("Media no longer available", response.status)
  }
  return response.blob()
}

export async function sendWhatsappTemplate(details: {
  accountId: string
  phoneNumberId: string
  to: string
  templateName: string
  languageCode: string
  components?: any[]
}): Promise<WhatsappSendResult> {
  return apiRequest<WhatsappSendResult>(WHATSAPP_ENDPOINTS.SEND_TEMPLATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function createWhatsappTemplate(details: {
  accountId: string
  wabaId: string
  template: {
    name: string
    category: string
    language: string
    components: any[]
  }
}): Promise<WhatsappTemplate> {
  return apiRequest<WhatsappTemplate>(WHATSAPP_ENDPOINTS.TEMPLATES, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function updateWhatsappTemplate(
  templateId: string,
  details: {
    accountId: string
    category?: string
    components: any[]
  }
): Promise<WhatsappTemplate> {
  return apiRequest<WhatsappTemplate>(WHATSAPP_ENDPOINTS.UPDATE_TEMPLATE(templateId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function listWhatsappTemplates(accountId: string, wabaId: string): Promise<WhatsappTemplate[]> {
  return apiRequest<WhatsappTemplate[]>(WHATSAPP_ENDPOINTS.LIST_TEMPLATES(accountId, wabaId))
}

export interface GeneratedTemplateVariable {
  position: number
  name: string
  example: string
}

export interface GeneratedTemplateCompliance {
  passed: boolean
  riskLevel: "low" | "medium" | "high"
  notes: string[]
}

export interface GeneratedTemplate {
  tone: "professional" | "casual" | "promotional"
  name: string
  category: "UTILITY" | "MARKETING"
  language: string
  body: string
  variables: GeneratedTemplateVariable[]
  compliance: GeneratedTemplateCompliance
  components: any[]
}

export interface GenerateTemplatesResponse {
  providers: { draft: string; review: string }
  templates: GeneratedTemplate[]
}

export async function generateWhatsappTemplates(details: {
  accountId: string
  wabaId: string
  prompt: string
  provider?: "anthropic" | "gemini"
}): Promise<GenerateTemplatesResponse> {
  return apiRequest<GenerateTemplatesResponse>(WHATSAPP_ENDPOINTS.GENERATE_TEMPLATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function deleteWhatsappTemplate(
  name: string,
  accountId: string,
  wabaId: string
): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(WHATSAPP_ENDPOINTS.DELETE_TEMPLATE(name, accountId, wabaId), {
    method: "DELETE",
  })
}

// Chat inbox
export interface ConversationFilters {
  assigneeId?: string
  unassigned?: boolean
  label?: string
}

// Mirrors the backend Conversation entity (listConversations returns raw rows).
export interface Conversation {
  id: string
  wabaId: string
  phoneNumberId: string
  contactWaId: string
  contactName?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  lastMessageDirection?: "inbound" | "outbound"
  /**
   * Unread **for the signed-in user**, derived from their own read cursor
   * (`conversation_read_state`), not a team-wide counter. Two agents looking at
   * the same conversation can legitimately see different numbers, and one of
   * them opening it no longer clears the other's badge.
   *
   * The one exception is a realtime socket payload, which has no viewer to
   * compute a count for and still carries the legacy shared number.
   */
  unreadCount: number
  assigneeId?: string | null
  assigneeName?: string | null
  labels: string[]
  createdAt: string
}

export async function getChatConversations(
  accountId: string,
  filters?: ConversationFilters
): Promise<Conversation[]> {
  return apiRequest<Conversation[]>(CHAT_ENDPOINTS.LIST_CONVERSATIONS(accountId, filters))
}

/** `total` is unread messages, `conversations` how many threads they're spread over. */
export interface UnreadTotal {
  total: number
  conversations: number
}

/**
 * The signed-in user's unread total. Scoped both ways: to their read cursor and
 * to the conversations their `conversationScope` lets them see, so it can't
 * advertise work they can't open.
 */
export async function getUnreadTotal(accountId: string): Promise<UnreadTotal> {
  return apiRequest<UnreadTotal>(CHAT_ENDPOINTS.UNREAD_TOTAL(accountId))
}

export async function assignConversation(
  conversationId: string,
  accountId: string,
  assigneeId: string
): Promise<Conversation> {
  return apiRequest<Conversation>(CHAT_ENDPOINTS.ASSIGN(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, assigneeId }),
  })
}

export async function unassignConversation(
  conversationId: string,
  accountId: string
): Promise<Conversation> {
  return apiRequest<Conversation>(CHAT_ENDPOINTS.UNASSIGN(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Labels are stored lowercased server-side — send raw.
export async function addConversationLabel(
  conversationId: string,
  accountId: string,
  label: string
): Promise<Conversation> {
  return apiRequest<Conversation>(CHAT_ENDPOINTS.ADD_LABEL(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, label }),
  })
}

export async function removeConversationLabel(
  conversationId: string,
  accountId: string,
  label: string
): Promise<Conversation> {
  return apiRequest<Conversation>(CHAT_ENDPOINTS.REMOVE_LABEL(conversationId, label, accountId), {
    method: "DELETE",
  })
}

export interface ConversationNote {
  id: string
  conversationId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export async function getConversationNotes(
  conversationId: string,
  accountId: string
): Promise<ConversationNote[]> {
  return apiRequest<ConversationNote[]>(CHAT_ENDPOINTS.LIST_NOTES(conversationId, accountId))
}

export async function addConversationNote(
  conversationId: string,
  accountId: string,
  body: string
): Promise<ConversationNote> {
  return apiRequest<ConversationNote>(CHAT_ENDPOINTS.ADD_NOTE(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, body }),
  })
}

export async function deleteConversationNote(
  conversationId: string,
  accountId: string,
  noteId: string
): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(CHAT_ENDPOINTS.DELETE_NOTE(conversationId, noteId, accountId), {
    method: "DELETE",
  })
}

// Team management
export type TeamRole = "owner" | "admin" | "agent"

/**
 * How much of the shared inbox a member can see.
 *
 * - `all` — every conversation on the account.
 * - `unassigned_and_own` — the queue plus what's assigned to them.
 * - `own` — only their own assignments.
 *
 * Only meaningful for an **agent**: the server resolves an admin (and the
 * owner) to `all` regardless of what's stored, so don't offer the choice for
 * them — it would be a setting that silently does nothing.
 */
export type ConversationScope = "all" | "unassigned_and_own" | "own"

export interface TeamOwner {
  userId: string
  name: string
  email: string
  role: "owner"
}

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  role: "admin" | "agent"
  /** Resolved, not raw: an admin always comes back as `all`. */
  conversationScope: ConversationScope
  createdAt: string
}

export interface TeamMembersResponse {
  owner: TeamOwner | null
  members: TeamMember[]
}

export async function getTeamMembers(accountId: string): Promise<TeamMembersResponse> {
  return apiRequest<TeamMembersResponse>(TEAM_ENDPOINTS.LIST_MEMBERS(accountId))
}

// Backend's addMember returns the member without `createdAt` (only listMembers
// includes it), so the response is TeamMember minus that field.
export type AddedTeamMember = Omit<TeamMember, "createdAt">

/**
 * Adds someone who already has an account here. For an address that doesn't yet,
 * create an invite instead — `addTeamMember` 404s on an unknown email.
 */
export async function addTeamMember(
  accountId: string,
  email: string,
  role: "admin" | "agent" = "agent",
  conversationScope?: ConversationScope
): Promise<AddedTeamMember> {
  return apiRequest<AddedTeamMember>(TEAM_ENDPOINTS.ADD_MEMBER, {
    method: "POST",
    body: JSON.stringify({
      accountId,
      email,
      role,
      ...(conversationScope ? { conversationScope } : {}),
    }),
  })
}

/**
 * Patches role and/or inbox scope. Both are optional server-side, so pass only
 * what changed — sending a scope alongside a promotion to `admin` is harmless
 * but pointless, since an admin resolves to `all` either way.
 */
export async function updateTeamMember(
  memberId: string,
  accountId: string,
  changes: { role?: "admin" | "agent"; conversationScope?: ConversationScope }
): Promise<{ id: string; role: "admin" | "agent"; conversationScope: ConversationScope }> {
  return apiRequest<{
    id: string
    role: "admin" | "agent"
    conversationScope: ConversationScope
  }>(TEAM_ENDPOINTS.UPDATE_MEMBER(memberId), {
    method: "PATCH",
    body: JSON.stringify({ accountId, ...changes }),
  })
}

// Customer API keys

/** Per-minute request ceilings: free 60, starter 300, pro 1200, enterprise 6000. */
export type ApiKeyTier = "free" | "starter" | "pro" | "enterprise"

export interface ApiKey {
  id: string
  name: string
  /** First characters of the key — enough to recognise it, useless as a credential. */
  prefix: string
  tier: ApiKeyTier
  /** Effective ceiling: the override if set, else the tier's limit. */
  rateLimitPerMin: number
  /** The raw override, or null when the key just follows its tier. */
  rateLimitOverride: number | null
  revokedAt: string | null
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

/**
 * The create response — the **only** place the key itself exists. Only its hash
 * is stored, so it can never be shown again; offer it for copying now or the
 * customer has to mint another.
 */
export interface CreatedApiKey {
  id: string
  name: string
  key: string
  prefix: string
  tier: ApiKeyTier
  rateLimitPerMin: number
  expiresAt: string | null
  createdAt: string
}

export interface ApiUsageSummary {
  endpoints: {
    path: string
    method: string
    requests: number
    errors: number
    rateLimited: number
    avgDurationMs: number
  }[]
  totalRequests: number
}

/**
 * Mints a key. `rateLimitPerMin` overrides the tier ceiling; **0 is honoured as
 * zero**, which is the deliberate way to park a key without revoking it — omit
 * the field entirely to follow the tier instead.
 */
export async function createApiKey(details: {
  accountId: string
  name: string
  tier?: ApiKeyTier
  rateLimitPerMin?: number
  expiresAt?: string
}): Promise<CreatedApiKey> {
  return apiRequest<CreatedApiKey>(API_KEYS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listApiKeys(accountId: string): Promise<ApiKey[]> {
  return apiRequest<ApiKey[]>(API_KEYS_ENDPOINTS.LIST(accountId))
}

/** Request counts, errors and throttling per endpoint. Account-wide, not per key. */
export async function getApiUsage(
  accountId: string,
  from?: string,
  to?: string,
  limit?: number
): Promise<ApiUsageSummary> {
  return apiRequest<ApiUsageSummary>(API_KEYS_ENDPOINTS.USAGE(accountId, from, to, limit))
}

/**
 * Revokes a key. Idempotent, and deliberately not a delete: deleting one
 * orphans its usage history and frees the hash to be minted again.
 */
export async function revokeApiKey(
  keyId: string,
  accountId: string
): Promise<{ id: string; prefix: string; revokedAt: string | null }> {
  return apiRequest<{ id: string; prefix: string; revokedAt: string | null }>(
    API_KEYS_ENDPOINTS.REVOKE(keyId, accountId),
    { method: "DELETE" }
  )
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired"

export interface TeamInvite {
  id: string
  email: string
  role: "admin" | "agent"
  conversationScope: ConversationScope
  status: InviteStatus
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

/**
 * The create response — the **only** time the token exists in readable form.
 * Only its hash is stored, so a database dump isn't a set of working
 * invitations, and it can never be fetched again. Offer it for copying at this
 * moment or it's gone.
 */
export interface CreatedTeamInvite {
  id: string
  email: string
  role: "admin" | "agent"
  conversationScope: ConversationScope
  expiresAt: string
  token: string
}

/**
 * Invites someone by email whether or not they've signed up here — unlike
 * `addTeamMember`, which 404s on an unknown address. Creating one supersedes
 * any live invite to the same address, so two valid links can't coexist.
 * They expire in seven days.
 */
export async function createTeamInvite(details: {
  accountId: string
  email: string
  role?: "admin" | "agent"
  conversationScope?: ConversationScope
}): Promise<CreatedTeamInvite> {
  return apiRequest<CreatedTeamInvite>(TEAM_ENDPOINTS.CREATE_INVITE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listTeamInvites(accountId: string): Promise<TeamInvite[]> {
  return apiRequest<TeamInvite[]>(TEAM_ENDPOINTS.LIST_INVITES(accountId))
}

/** Marks rather than deletes: "who was invited, and what happened" stays answerable. */
export async function revokeTeamInvite(
  inviteId: string,
  accountId: string
): Promise<{ id: string; status: InviteStatus }> {
  return apiRequest<{ id: string; status: InviteStatus }>(
    TEAM_ENDPOINTS.REVOKE_INVITE(inviteId, accountId),
    { method: "DELETE" }
  )
}

/**
 * Redeems an invite as the signed-in user, and only for the invited address.
 *
 * Every rejection comes back with the same message on purpose — expired,
 * revoked, already used, unknown and wrong-address are indistinguishable, so a
 * stale link can't be used to learn about an account. Don't try to explain
 * *why* one failed.
 */
export async function acceptTeamInvite(
  token: string
): Promise<{ accountId: string; role: "admin" | "agent"; conversationScope: ConversationScope }> {
  return apiRequest<{
    accountId: string
    role: "admin" | "agent"
    conversationScope: ConversationScope
  }>(TEAM_ENDPOINTS.ACCEPT_INVITE, {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}

export async function deleteTeamMember(memberId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(TEAM_ENDPOINTS.DELETE_MEMBER(memberId, accountId), {
    method: "DELETE",
  })
}

// One stored WhatsApp message/status event. `payload` is the raw Meta message
// JSON (many shapes by messageType), consumed polymorphically by the renderer,
// so it stays `any` — the envelope around it is typed.
export interface ChatMessage {
  id: string
  wabaId: string
  phoneNumberId: string
  direction: "inbound" | "outbound" | "status"
  waMessageId?: string
  from?: string
  recipientId?: string
  messageType?: string
  status?: string
  errorCode?: number | null
  errorTitle?: string | null
  payload: any
  conversationId?: string
  receivedAt: string
}

export async function getChatMessages(
  conversationId: string,
  accountId: string,
  before?: string,
  limit?: number
): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(CHAT_ENDPOINTS.LIST_MESSAGES(conversationId, accountId, before, limit))
}

export async function markChatConversationRead(
  conversationId: string,
  accountId: string
): Promise<Conversation> {
  return apiRequest<Conversation>(CHAT_ENDPOINTS.MARK_READ(conversationId, accountId), {
    method: "POST",
  })
}

// Automation rules
/**
 * Automation is a rule engine: one trigger, optional conditions, an ordered
 * list of actions. These mirror the zod schemas in the backend's
 * `src/automation/automation-rules.ts` — that file validates every write, so a
 * shape not expressible here is a 400, and a shape it accepts but we don't
 * model is a rule our UI can't display. Keep the two in step.
 *
 * (This replaced the old keyword/reply columns, which the rule-engine migration
 * dropped. There is no compatibility mode: the server no longer understands
 * `matchType`/`replyText`.)
 */
export type AutomationTrigger =
  /** `any` fires on every inbound text — the catch-all, usually lowest priority. */
  | { type: "keyword"; matchType: "exact" | "contains" | "any"; keywords: string[] }
  /** Empty `buttonIds` = any button reply. Ids are the payload ids Meta echoes back. */
  | { type: "button"; buttonIds: string[] }
  | { type: "new_contact" }
  | { type: "tag_added"; tag: string }
  /** Hours since our last outbound with no inbound after it. Server caps at 720 (30 days). */
  | { type: "no_reply"; hours: number }

export type AutomationTriggerType = AutomationTrigger["type"]

/**
 * Evaluated against the contact + the triggering message, in memory. Narrower
 * than segment rules on purpose: those compile to SQL and can ask about history,
 * which would mean a query per inbound message.
 */
export type AutomationCondition =
  | { type: "tag"; operator: "has" | "not_has"; value: string }
  | {
      type: "attribute"
      key: string
      operator: "equals" | "not_equals" | "contains" | "exists" | "not_exists"
      value?: string
    }
  | { type: "opted_in"; value: boolean }
  | { type: "text"; operator: "contains" | "equals" | "not_contains"; value: string }

export interface AutomationConditions {
  combinator: "and" | "or"
  conditions: AutomationCondition[]
}

/**
 * Executed in order, each independently fallible — one failing action does not
 * abort the rest. `start_flow` is how a rule branches: the flow engine owns the
 * graph walk, automation deliberately doesn't duplicate it.
 */
export type AutomationAction =
  /** Supports {{name}}, {{waId}}, {{attributes.key}} — same tokens as campaigns. */
  | { type: "send_text"; text: string }
  | {
      type: "send_template"
      templateName: string
      templateLanguage: string
      parameters?: string[]
    }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "set_attribute"; key: string; value: string }
  | { type: "assign_agent"; agentUserId: string; agentName?: string }
  | { type: "start_flow"; flowId: string }
  | { type: "call_webhook"; url: string; includeContact?: boolean }

export interface AutomationRuleDetails {
  accountId: string
  wabaId: string
  phoneNumberId: string
  name: string
  trigger: AutomationTrigger
  /** Omitted or null = fire whenever the trigger matches. */
  conditions?: AutomationConditions | null
  actions: AutomationAction[]
  isActive?: boolean
  /** Lower runs first; only the first matching rule fires per event. 0–1000. */
  priority?: number
}

/**
 * A persisted rule: the input fields (minus the accountId relation) plus the
 * server-assigned id, timestamps, and `triggerType` — denormalized out of
 * `trigger` server-side so the engine can load only the rules an event could
 * possibly fire. Read `trigger.type`; `triggerType` is the same value and exists
 * for the index.
 */
export interface AutomationRule extends Omit<AutomationRuleDetails, "accountId"> {
  id: string
  triggerType: AutomationTriggerType
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export async function createAutomationRule(details: AutomationRuleDetails): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(AUTOMATION_ENDPOINTS.CREATE_RULE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listAutomationRules(accountId: string): Promise<AutomationRule[]> {
  return apiRequest<AutomationRule[]>(AUTOMATION_ENDPOINTS.LIST_RULES(accountId))
}

export async function updateAutomationRule(
  ruleId: string,
  details: { accountId: string } & Partial<Omit<AutomationRuleDetails, "accountId">>
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(AUTOMATION_ENDPOINTS.UPDATE_RULE(ruleId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteAutomationRule(ruleId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(AUTOMATION_ENDPOINTS.DELETE_RULE(ruleId, accountId), {
    method: "DELETE",
  })
}

// Analytics
export interface AnalyticsRates {
  deliveryRate: number
  readRate: number
  replyRate: number
  /**
   * Unique recipients who clicked / sent. Only meaningful for a campaign that
   * tracked its links — one without them reports 0%, which is honest rather
   * than missing: a plain URL in a message is genuinely invisible to us.
   */
  clickRate: number
  failureRate: number
}

export interface AnalyticsOverview {
  range: { from: string; to: string }
  campaigns: {
    total: number
    /**
     * Every status gets a bucket. The backend counts these against a `COUNT(*)`
     * total, so a status missing here appears nowhere while still inflating the
     * total — the numbers stop adding up rather than obviously breaking.
     */
    byStatus: {
      scheduled: number
      running: number
      paused: number
      completed: number
      cancelled: number
    }
  }
  recipients: {
    totalRecipients: number
    sentCount: number
    deliveredCount: number
    readCount: number
    failedCount: number
    skippedCount: number
    repliedCount: number
    /** Unique recipients who clicked a tracked link. */
    clickedCount: number
  }
  rates: AnalyticsRates
  messaging: { inbound: number; outbound: number }
  /** Ranged on when each sale happened, not when it was reported. */
  revenue: RevenueSummary
}

export interface CampaignTimelinePoint {
  bucket: string
  sent: number
  delivered: number
  read: number
  replied: number
}

export interface CampaignAnalytics {
  campaign: Campaign
  rates: AnalyticsRates
  interval: "hour" | "day"
  timeline: CampaignTimelinePoint[]
  /**
   * Money for this campaign. `cost` comes from the wallet ledger joined to
   * recipients by wamid — what it actually cost when it ran, never re-priced at
   * today's rates, because rates and markup both move and re-pricing an old
   * campaign restates history.
   */
  revenue: {
    conversions: number
    revenueMicros: string
    revenue: number
    currency: string
    costMicros: string
    cost: number
    /**
     * Revenue per unit of message cost. **Null rather than 0** when nothing was
     * charged — a campaign that cost nothing has no return to compute, and a 0
     * would sort it below a profitable one.
     */
    roas: number | null
    netMicros: string
  }
}

export interface MessagingPoint {
  bucket: string
  inbound: number
  outbound: number
}

export interface MessagingAnalytics {
  range: { from: string; to: string }
  interval: "hour" | "day"
  points: MessagingPoint[]
}

export async function getAnalyticsOverview(
  accountId: string,
  from?: string,
  to?: string
): Promise<AnalyticsOverview> {
  return apiRequest<AnalyticsOverview>(ANALYTICS_ENDPOINTS.OVERVIEW(accountId, from, to))
}

export async function getCampaignAnalytics(
  campaignId: string,
  accountId: string,
  interval?: "hour" | "day"
): Promise<CampaignAnalytics> {
  return apiRequest<CampaignAnalytics>(ANALYTICS_ENDPOINTS.CAMPAIGN(campaignId, accountId, interval))
}

export async function getMessagingAnalytics(
  accountId: string,
  from?: string,
  to?: string,
  interval?: "hour" | "day"
): Promise<MessagingAnalytics> {
  return apiRequest<MessagingAnalytics>(ANALYTICS_ENDPOINTS.MESSAGING(accountId, from, to, interval))
}

// Drip sequences
/**
 * A media header on a template send. Most approved marketing templates have
 * one, and until the backend accepted this they were unusable here.
 *
 * `link` XOR `mediaId` — sending both is a 400, as is sending neither. `link`
 * may contain the same `{{name}}` / `{{attributes.key}}` tokens as body
 * parameters, which is how a per-recipient image works; a campaign freezes them
 * at creation, a drip resolves them at send time. `filename` is documents only
 * (Meta ignores it elsewhere, which reads as the filename silently failing).
 */
export interface TemplateHeaderMedia {
  type: "image" | "video" | "document"
  link?: string
  mediaId?: string
  filename?: string
}

export interface DripStep {
  delayHours: number
  templateName: string
  templateLanguage: string
  templateParameters?: string[]
  headerMedia?: TemplateHeaderMedia
}

/**
 * What ends an enrollment before its last step. An empty list means run to
 * completion regardless, which is the old behaviour and stays the default.
 *
 * Without one of these, a sequence keeps sending on schedule to someone who
 * already answered — read as being spammed by a bot that isn't listening, and
 * every step after the reply is a charged message with negative value.
 */
export type DripExitCondition =
  | { type: "reply" }
  /** Omit `buttonId` to exit on any button tap. */
  | { type: "button_click"; buttonId?: string }
  | { type: "tag_added"; tag: string }
  | { type: "tag_removed"; tag: string }

/**
 * Why an enrollment stopped early — recorded for every auto-stop, not just the
 * exit conditions. `replied` is the sequence working; `opted_out` is it
 * failing. The status alone (`stopped`) can't tell them apart.
 */
export type DripExitReason =
  | "replied"
  | "button_clicked"
  | "tag_added"
  | "tag_removed"
  | "opted_out"
  | "contact_deleted"
  | "sequence_inactive"
  | "send_failed"

export interface DripSequence {
  id: string
  name: string
  description: string | null
  phoneNumberId: string
  wabaId: string
  triggerType: "manual" | "tag"
  triggerTag: string | null
  isActive: boolean
  steps: DripStep[]
  /** Empty = run every step regardless of what the contact does. */
  exitConditions: DripExitCondition[]
  enrollments?: { active: number; completed: number }
  createdAt: string
  updatedAt: string
}

export type DripEnrollmentStatus = "active" | "completed" | "cancelled" | "stopped"

export interface DripEnrollment {
  id: string
  contactId: string
  waId: string
  conversationId?: string | null
  currentStepIndex: number
  nextStepAt: string | null
  status: DripEnrollmentStatus
  sentCount: number
  /**
   * Why it stopped. Set on every auto-stop, so a `stopped` enrollment can say
   * whether the contact replied (the sequence worked) or opted out (it didn't).
   */
  exitReason?: DripExitReason | null
  exitedAt?: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface DripDetails {
  accountId: string
  phoneNumberId: string
  wabaId: string
  name: string
  description?: string
  triggerType: "manual" | "tag"
  triggerTag?: string
  isActive?: boolean
  steps: DripStep[]
  /** Omit to leave unchanged on update; `[]` explicitly clears them. */
  exitConditions?: DripExitCondition[]
}

export async function createDrip(details: DripDetails): Promise<DripSequence> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listDrips(accountId: string): Promise<DripSequence[]> {
  return apiRequest<DripSequence[]>(DRIPS_ENDPOINTS.LIST(accountId))
}

export async function getDrip(dripId: string, accountId: string): Promise<DripSequence> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.GET(dripId, accountId))
}

export async function updateDrip(
  dripId: string,
  details: { accountId: string } & Partial<Omit<DripDetails, "accountId">>
): Promise<DripSequence> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.UPDATE(dripId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteDrip(dripId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(DRIPS_ENDPOINTS.DELETE(dripId, accountId), {
    method: "DELETE",
  })
}

// Enrolls specific contacts and/or all opted-in contacts of a tag. Backend
// skips contacts not opted in or already actively enrolled → skipped count.
export async function enrollDripContacts(
  dripId: string,
  accountId: string,
  payload: { contactIds?: string[]; tag?: string }
): Promise<{ enrolled: number; skipped: number }> {
  return apiRequest<{ enrolled: number; skipped: number }>(DRIPS_ENDPOINTS.ENROLL(dripId), {
    method: "POST",
    body: JSON.stringify({ accountId, ...payload }),
  })
}

export async function listDripEnrollments(
  dripId: string,
  accountId: string,
  filters: { status?: DripEnrollmentStatus; limit?: number; offset?: number } = {}
): Promise<{ items: DripEnrollment[]; total: number }> {
  return apiRequest<{ items: DripEnrollment[]; total: number }>(
    DRIPS_ENDPOINTS.ENROLLMENTS({ dripId, accountId, ...filters })
  )
}

export async function cancelDripEnrollment(
  dripId: string,
  enrollmentId: string,
  accountId: string
): Promise<DripEnrollment> {
  return apiRequest<DripEnrollment>(DRIPS_ENDPOINTS.CANCEL_ENROLLMENT(dripId, enrollmentId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Quality / health alerts (backend AlertsModule — raised from
// phone_number_quality_update webhooks when a number's quality degrades)
export interface QualityAlert {
  id: string
  accountId?: string | null
  wabaId?: string | null
  phoneNumberId?: string | null
  displayPhoneNumber?: string | null
  oldRating?: string | null
  newRating: string
  tier?: string | null
  reason?: string | null
  acknowledged: boolean
  createdAt: string
}

export async function listAlerts(
  accountId: string,
  unacknowledgedOnly = false
): Promise<QualityAlert[]> {
  return apiRequest<QualityAlert[]>(ALERTS_ENDPOINTS.LIST(accountId, unacknowledgedOnly))
}

export async function acknowledgeAlert(alertId: string, accountId: string): Promise<QualityAlert> {
  return apiRequest<QualityAlert>(ALERTS_ENDPOINTS.ACK(alertId, accountId), {
    method: "POST",
  })
}

// Chatbot flows
export type FlowNode =
  | { id: string; type: "message"; text: string; next?: string }
  | {
      id: string
      type: "buttons"
      text: string
      buttons: { title: string; next?: string }[]
      fallbackNext?: string
    }
  | { id: string; type: "question"; text: string; variable: string; next?: string }
  | {
      id: string
      type: "condition"
      /** Evaluated in order; the first match wins. */
      branches: FlowConditionBranch[]
      /**
       * Where to go when nothing matches. Omitting it ends the flow, which is a
       * real choice ("only these answers continue") — so the builder doesn't
       * force one.
       */
      defaultNext?: string
    }
  | {
      id: string
      type: "delay"
      /** 1–1440. A day is the cap because free-form text can't leave the 24h window. */
      minutes: number
      /** Required: a delay with nowhere to go holds a session open for nothing. */
      next: string
    }
  | { id: string; type: "handoff"; text?: string }
  | { id: string; type: "end"; text?: string }

/**
 * Comparison operators a condition branch can use.
 *
 * There is deliberately no regex operator: a customer-supplied pattern runs on
 * every reply, Node's regex engine has no timeout, and a catastrophically
 * backtracking pattern would take the process down.
 */
export type FlowConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_set"
  | "is_empty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"

export interface FlowConditionBranch {
  /** A collected variable, or the built-in `name` / `waId`. */
  variable: string
  operator: FlowConditionOperator
  /** Required except for `is_set`/`is_empty`, which reject one. Supports {{tokens}}. */
  value?: string
  next: string
}

export interface FlowDefinition {
  entryNodeId: string
  nodes: FlowNode[]
}

export interface Flow {
  id: string
  name: string
  description: string | null
  phoneNumberId: string
  triggerMatchType: "exact" | "contains" | "any"
  triggerKeywords: string[]
  isActive: boolean
  priority: number
  definition: FlowDefinition
  createdAt: string
  updatedAt: string
}

export interface FlowSession {
  id: string
  contactWaId: string
  conversationId?: string | null
  currentNodeId: string | null
  variables: Record<string, string>
  /**
   * When a `delay` node's timer is due. **Its presence, not the status, is what
   * distinguishes "waiting on a timer" from "waiting on a reply"** — the status
   * stays `active` through a delay so a keyword or a `start_flow` action can't
   * open a second session for a contact who is already mid-conversation.
   */
  resumeAt?: string | null
  status: "active" | "completed" | "handed_off"
  createdAt: string
  updatedAt: string
}

export interface FlowDetails {
  accountId: string
  phoneNumberId: string
  name: string
  description?: string
  triggerMatchType: "exact" | "contains" | "any"
  triggerKeywords?: string[]
  isActive?: boolean
  priority?: number
  definition: FlowDefinition
}

export async function createFlow(details: FlowDetails): Promise<Flow> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listFlows(accountId: string): Promise<Flow[]> {
  return apiRequest<Flow[]>(FLOWS_ENDPOINTS.LIST(accountId))
}

export async function getFlow(flowId: string, accountId: string): Promise<Flow> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.GET(flowId, accountId))
}

export async function updateFlow(
  flowId: string,
  details: { accountId: string } & Partial<Omit<FlowDetails, "accountId">>
): Promise<Flow> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.UPDATE(flowId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteFlow(flowId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(FLOWS_ENDPOINTS.DELETE(flowId, accountId), {
    method: "DELETE",
  })
}

export async function listFlowSessions(
  flowId: string,
  accountId: string,
  filters: { status?: FlowSession["status"]; limit?: number; offset?: number } = {}
): Promise<{ items: FlowSession[]; total: number }> {
  return apiRequest<{ items: FlowSession[]; total: number }>(
    FLOWS_ENDPOINTS.SESSIONS({ flowId, accountId, ...filters })
  )
}

// Segments (saved audience filters, evaluated live server-side)
export type SegmentCondition =
  | { type: "field"; field: "name" | "waId"; operator: "equals" | "not_equals" | "contains" | "starts_with"; value: string }
  | { type: "field"; field: "optedIn"; operator: "is_true" | "is_false" }
  | { type: "field"; field: "createdAt"; operator: "before" | "after"; value: string }
  | { type: "attribute"; key: string; operator: "equals" | "not_equals" | "contains"; value: string }
  | { type: "attribute"; key: string; operator: "exists" | "not_exists" }
  | { type: "tag"; operator: "has" | "not_has"; value: string }
  | { type: "activity"; operator: "active_within" | "inactive_within"; days: number }
  | {
      type: "campaign"
      /**
       * `clicked` needs a tracked link on the campaign — one that never tracked
       * simply matches nobody, which is truthful rather than an error.
       */
      event: "received" | "read" | "replied" | "clicked"
      operator: "within" | "not_within"
      days: number
      campaignId?: string
    }

/**
 * Conditions joined by one combinator, where any member may itself be a group.
 *
 * The old flat shape is exactly a group with no nesting, so every stored rule
 * set still parses — but a nested group **must** carry `type: "group"`, which
 * is what keeps it distinguishable from a leaf condition. Omitting it makes a
 * malformed condition parse as an empty group instead of failing.
 *
 * Bounded server-side: 5 levels deep, 20 members per group, 50 leaf conditions
 * in total. Those bound the SQL this compiles to — past them Postgres accepts
 * the query and plans it badly, which shows up as a preview that hangs rather
 * than an error anyone can act on.
 */
export interface SegmentRules {
  type?: "group"
  combinator: "and" | "or"
  conditions: Array<SegmentCondition | SegmentRules>
}

/**
 * `dynamic` — membership is a live query over `rules`, re-evaluated every time.
 * `static` — an explicit list (`rules` is null); membership changes only when
 * someone adds or removes contacts.
 */
export type SegmentType = "dynamic" | "static"

export interface Segment {
  id: string
  name: string
  description: string | null
  type: SegmentType
  /** Null on a static segment, whose membership lives in an explicit list. */
  rules: SegmentRules | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

/** A group node vs a leaf condition, for walking rules. */
export function isSegmentGroup(node: SegmentCondition | SegmentRules): node is SegmentRules {
  return (node as SegmentRules).conditions !== undefined
}

export interface SegmentPreviewResult {
  total: number
  sample: Contact[]
}

/**
 * `rules` is required for a dynamic segment and refused on a static one;
 * `contactIds` is the reverse. Sending both, or neither, is a 400 — the two
 * kinds of segment answer "who matches?" in incompatible ways.
 */
export async function createSegment(details: {
  accountId: string
  name: string
  description?: string
  type?: SegmentType
  rules?: SegmentRules
  /** Static segments only: initial membership, up to 5000 ids. */
  contactIds?: string[]
}): Promise<Segment> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listSegments(accountId: string): Promise<Segment[]> {
  return apiRequest<Segment[]>(SEGMENTS_ENDPOINTS.LIST(accountId))
}

export async function getSegment(segmentId: string, accountId: string): Promise<Segment> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.GET(segmentId, accountId))
}

export async function listSegmentContacts(
  segmentId: string,
  accountId: string,
  limit?: number,
  offset?: number
): Promise<ContactListResponse> {
  return apiRequest<ContactListResponse>(SEGMENTS_ENDPOINTS.CONTACTS(segmentId, accountId, limit, offset))
}

export async function updateSegment(
  segmentId: string,
  details: { accountId: string; name?: string; description?: string; rules?: SegmentRules }
): Promise<Segment> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.UPDATE(segmentId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

/**
 * Static segments only — the server rejects these on a dynamic segment rather
 * than accepting a write the next membership query would ignore. Idempotent:
 * re-adding an existing member is a no-op, not an error.
 */
export async function addSegmentMembers(
  segmentId: string,
  accountId: string,
  contactIds: string[]
): Promise<{ added: number; skipped: number }> {
  return apiRequest<{ added: number; skipped: number }>(
    SEGMENTS_ENDPOINTS.ADD_MEMBERS(segmentId),
    { method: "POST", body: JSON.stringify({ accountId, contactIds }) }
  )
}

/** POST, not DELETE: the ids travel in a body, and DELETE-with-body is unreliable through proxies. */
export async function removeSegmentMembers(
  segmentId: string,
  accountId: string,
  contactIds: string[]
): Promise<{ removed: number }> {
  return apiRequest<{ removed: number }>(
    SEGMENTS_ENDPOINTS.REMOVE_MEMBERS(segmentId),
    { method: "POST", body: JSON.stringify({ accountId, contactIds }) }
  )
}

export async function deleteSegment(segmentId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(SEGMENTS_ENDPOINTS.DELETE(segmentId, accountId), {
    method: "DELETE",
  })
}

// Evaluates rules without saving — powers the live builder preview.
export async function previewSegment(
  accountId: string,
  rules: SegmentRules,
  limit?: number
): Promise<SegmentPreviewResult> {
  return apiRequest<SegmentPreviewResult>(SEGMENTS_ENDPOINTS.PREVIEW, {
    method: "POST",
    body: JSON.stringify({ accountId, rules, ...(limit != null ? { limit } : {}) }),
  })
}

// Broadcast campaigns

/**
 * `paused` is a real status, unlike deferral — and the distinction is the point.
 * A deferred campaign wants to send and can't (tier cap, empty wallet); a paused
 * one has been stopped by a human. Pausing clears any deferral reason, so the
 * two never render together.
 */
export type CampaignStatus = "scheduled" | "running" | "paused" | "completed" | "cancelled"

export type CampaignRecipientStatus = "pending" | "sent" | "delivered" | "read" | "failed" | "skipped"

export interface Campaign {
  id: string
  name: string
  wabaId: string
  phoneNumberId: string
  templateName: string
  templateLanguage: string
  templateParameters: string[]
  audienceTag: string | null
  segmentId?: string | null
  status: CampaignStatus
  scheduledAt: string | null
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  skippedCount: number
  repliedCount?: number
  /** Unique recipients who clicked a tracked link. 0 on a campaign that didn't track. */
  clickedCount?: number
  /** Whether URLs in this campaign's parameters were rewritten as tracked links. */
  trackLinks?: boolean
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  /**
   * Why a campaign that is still `running` isn't sending. Deliberately not a
   * `CampaignStatus` value — the campaign is starved, not paused — so treat it
   * as a modifier on `running`, never as a status of its own.
   *
   * `tier_cap`: the number hit its Meta messaging-tier daily allowance of unique
   * recipients. The dispatcher clears this by itself once the rolling 24h window
   * frees up budget or the tier is upgraded.
   *
   * `insufficient_balance`: the prepaid wallet ran dry mid-send. Unlike
   * `tier_cap` this never clears on its own — it needs a top-up — so the UI must
   * not tell the user to wait it out.
   */
  deferredReason?: "tier_cap" | "insufficient_balance" | null
  /** Deferred *since* — stamped once when deferral starts, not per dispatcher tick. */
  deferredAt?: string | null
  /**
   * Best-effort resume estimate (oldest send in the 24h window + 24h). Can be in
   * the past: concurrent campaigns on one number can overshoot the cap, and this
   * isn't re-stamped while the deferral holds. Always check before displaying.
   *
   * Only ever set for `tier_cap`; the backend passes `null` for
   * `insufficient_balance`, which resumes on a top-up rather than on a clock.
   */
  deferredUntil?: string | null
  /** Set while `status === "paused"`, cleared on resume. */
  pausedAt?: string | null
  /**
   * How the audience was decided. `snapshot` — membership resolved once at
   * creation and frozen into recipient rows. Consent is still re-checked per
   * recipient at send time, so this freezes *membership*, not permission.
   */
  audienceMode?: "snapshot"
  /**
   * What the send was expected to cost, stamped at creation. Present on the
   * create response; the rate card and markup both move, so this is what the
   * campaign was quoted at, not what it would cost today.
   */
  estimatedCost?: number
  estimatedCostMicros?: string
}

export interface CampaignRecipient {
  id: string
  contactId: string
  waId: string
  contactName: string | null
  status: CampaignRecipientStatus
  error: string | null
  attempts: number
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  repliedAt?: string | null
  /** When they first clicked a tracked link in this campaign. */
  clickedAt?: string | null
}

export interface CampaignRecipientListResponse {
  items: CampaignRecipient[]
  total: number
  limit: number
  offset: number
}

export async function createCampaign(details: {
  accountId: string
  wabaId: string
  phoneNumberId: string
  name: string
  templateName: string
  templateLanguage: string
  templateParameters?: string[]
  /** Required if the template has a media header — the send fails at Meta without it. */
  headerMedia?: TemplateHeaderMedia
  /**
   * Replace bare-URL template parameters with per-recipient tracked links so
   * clicks can be counted. Off by default on purpose: it changes the URL the
   * recipient actually sees, which is the customer's call, not a default.
   */
  trackLinks?: boolean
  // audienceTag and segmentId are mutually exclusive (400 if both)
  audienceTag?: string
  segmentId?: string
  scheduledAt?: string
}): Promise<Campaign> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

/**
 * A tracked short link. Campaign sends mint one **per recipient**, not per
 * campaign — a shared link can only say "someone clicked", and attributing a
 * click to a person is what feeds the unique CTR and the `clicked` segment
 * condition.
 */
export interface TrackedLink {
  id: string
  /** The short URL handed to the recipient. */
  url: string
  destination: string
  campaignId: string | null
  contactWaId: string | null
  clickCount: number
  firstClickedAt: string | null
  lastClickedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface TrackedLinkListResponse {
  total: number
  links: TrackedLink[]
}

/**
 * A reported sale. Attribution is **last touch** inside the server's window
 * (7 days by default), where a touch is the click if there was one and the send
 * otherwise — and `attributionModel`/`touchAt` are stored on the row rather
 * than derived, so revenue reported under one rule isn't silently restated when
 * the rule changes.
 */
export interface Conversion {
  id: string
  /** The caller's own order id. Supplying it is what makes reporting idempotent. */
  externalId: string | null
  waId: string
  contactId: string | null
  /** Integer-string micros; use for exact math. */
  valueMicros: string
  /** Decimal in `currency` — display this. */
  value: number
  currency: string
  occurredAt: string
  /** Null when nothing could be attributed — the sale still counts in the total. */
  campaignId: string | null
  attributionModel: string
  touchAt: string | null
  /** Whether it arrived from the dashboard or a customer's API key. */
  source: string
  voidedAt: string | null
  voidReason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface ConversionListResponse {
  total: number
  conversions: Conversion[]
}

/**
 * Revenue over a window. The attributed/total split is the honest answer to
 * "how much of our revenue did messaging touch" — the rest happened anyway, or
 * happened outside the attribution window.
 */
export interface RevenueSummary {
  conversions: number
  attributedConversions: number
  revenueMicros: string
  revenue: number
  attributedRevenueMicros: string
  attributedRevenue: number
}

/**
 * Records a sale. `value` is in **major units** (499.50, not micros) — an
 * integration has an order total, not a micro count. A currency the account
 * doesn't bill in is refused rather than converted: there is no FX anywhere in
 * this product.
 *
 * Supplying `externalId` makes the call idempotent, and a repeat returns the
 * existing row instead of erroring — a store retrying a failed webhook must not
 * double its reported revenue.
 */
export async function recordConversion(details: {
  accountId: string
  waId: string
  value: number
  currency?: string
  externalId?: string
  occurredAt?: string
  /** Overrides the resolver — use when a coupon code ties the sale to one campaign. */
  campaignId?: string
  metadata?: Record<string, unknown>
}): Promise<Conversion> {
  return apiRequest<Conversion>(CONVERSIONS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listConversions(params: {
  accountId: string
  campaignId?: string
  waId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}): Promise<ConversionListResponse> {
  return apiRequest<ConversionListResponse>(CONVERSIONS_ENDPOINTS.LIST(params))
}

/** Refund or cancellation. Marks the row rather than deleting it. */
export async function voidConversion(
  conversionId: string,
  accountId: string,
  reason?: string
): Promise<Conversion> {
  return apiRequest<Conversion>(CONVERSIONS_ENDPOINTS.VOID(conversionId), {
    method: "POST",
    body: JSON.stringify({ accountId, ...(reason ? { reason } : {}) }),
  })
}

/** Mints a standalone tracked link — campaign links are minted by the send itself. */
export async function createTrackedLink(details: {
  accountId: string
  destination: string
  expiresAt?: string
}): Promise<TrackedLink> {
  return apiRequest<TrackedLink>(LINKS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listTrackedLinks(
  accountId: string,
  limit = 50,
  offset = 0
): Promise<TrackedLinkListResponse> {
  return apiRequest<TrackedLinkListResponse>(LINKS_ENDPOINTS.LIST(accountId, limit, offset))
}

export async function listCampaigns(accountId: string): Promise<Campaign[]> {
  return apiRequest<Campaign[]>(CAMPAIGNS_ENDPOINTS.LIST(accountId))
}

export async function getCampaign(campaignId: string, accountId: string): Promise<Campaign> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.GET(campaignId, accountId))
}

export async function listCampaignRecipients(
  campaignId: string,
  accountId: string,
  filters: { status?: CampaignRecipientStatus; limit?: number; offset?: number } = {}
): Promise<CampaignRecipientListResponse> {
  return apiRequest<CampaignRecipientListResponse>(
    CAMPAIGNS_ENDPOINTS.RECIPIENTS({ campaignId, accountId, ...filters })
  )
}

/**
 * Stop sending, reversibly — recipients stay `pending`, which is the difference
 * from `cancelCampaign`, where they're skipped and can't be restored. Rejected
 * with a 400 unless the campaign is `scheduled` or `running`.
 */
export async function pauseCampaign(campaignId: string, accountId: string): Promise<Campaign> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.PAUSE(campaignId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

/**
 * Put a paused campaign back. The server picks the target from `startedAt`: one
 * that never started returns to `scheduled` (the dispatcher promotes it on the
 * next tick even if its scheduled time passed while paused — the work is still
 * owed), one that had started returns to `running`.
 */
export async function resumeCampaign(campaignId: string, accountId: string): Promise<Campaign> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.RESUME(campaignId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

/** Irreversible: remaining recipients are skipped. `paused` campaigns are cancellable directly. */
export async function cancelCampaign(campaignId: string, accountId: string): Promise<Campaign> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.CANCEL(campaignId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Contacts (CRM)
export interface Contact {
  id: string
  waId: string
  name: string | null
  tags: string[]
  attributes: Record<string, string>
  optedIn: boolean
  optedInAt: string | null
  optedOutAt: string | null
  optInSource: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
  limit: number
  offset: number
}

export interface ContactImportResult {
  total: number
  created: number
  updated: number
  skipped: { line: number; reason: string }[]
}

/** Backend delete/remove handlers return this, not the deleted entity. */
export interface DeleteResult {
  success: boolean
}

export interface ContactListFilters {
  tag?: string
  search?: string
  optedIn?: boolean
  limit?: number
  offset?: number
}

export async function listContacts(
  accountId: string,
  filters: ContactListFilters = {}
): Promise<ContactListResponse> {
  return apiRequest<ContactListResponse>(CONTACTS_ENDPOINTS.LIST({ accountId, ...filters }))
}

// Distinct custom-attribute keys across all contacts (backend does the DISTINCT
// server-side — complete + cheap, unlike deriving from a contact sample).
export async function getContactAttributeKeys(accountId: string): Promise<string[]> {
  return apiRequest<string[]>(CONTACTS_ENDPOINTS.ATTRIBUTE_KEYS(accountId))
}

export interface ContactTag {
  tag: string
  /** Contacts carrying this tag. */
  count: number
  /** How many of those can actually be messaged — the rest are opted out. */
  optedInCount: number
}

/**
 * Every distinct tag on the account, most-used first, counted server-side.
 *
 * Replaces deriving tags from a page of contacts, which quietly omitted any tag
 * that didn't appear in the first 100 rows — so the tag you were looking for
 * was missing exactly when you had enough contacts for tags to matter.
 */
export async function listContactTags(accountId: string): Promise<ContactTag[]> {
  return apiRequest<ContactTag[]>(CONTACTS_ENDPOINTS.TAGS(accountId))
}

/**
 * One contact by id. `CONTACTS_ENDPOINTS.GET` and the backend's
 * `GET /contacts/:id` both already existed; only this wrapper was missing, so
 * the contact profile page can load a single row instead of paging the list
 * looking for it.
 *
 * Throws (404) when the id doesn't belong to the account — callers should treat
 * a failure as "not found" rather than retrying.
 */
export async function getContact(contactId: string, accountId: string): Promise<Contact> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.GET(contactId, accountId))
}

export async function createContact(details: {
  accountId: string
  waId: string
  name?: string
  tags?: string[]
  attributes?: Record<string, string>
  optedIn?: boolean
}): Promise<Contact> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

// tags/attributes are full replacements on the backend, not merges
export async function updateContact(
  contactId: string,
  details: {
    accountId: string
    name?: string
    tags?: string[]
    attributes?: Record<string, string>
  }
): Promise<Contact> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.UPDATE(contactId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteContact(contactId: string, accountId: string): Promise<DeleteResult> {
  return apiRequest<DeleteResult>(CONTACTS_ENDPOINTS.DELETE(contactId, accountId), {
    method: "DELETE",
  })
}

export async function optInContact(
  contactId: string,
  accountId: string,
  source = "manual"
): Promise<Contact> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.OPT_IN(contactId), {
    method: "POST",
    body: JSON.stringify({ accountId, source }),
  })
}

export async function optOutContact(contactId: string, accountId: string): Promise<Contact> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.OPT_OUT(contactId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// CSV is sent as plain text in the JSON body (no multipart) — read the file
// client-side with FileReader before calling this.
export async function importContactsCsv(accountId: string, csv: string): Promise<ContactImportResult> {
  return apiRequest<ContactImportResult>(CONTACTS_ENDPOINTS.IMPORT, {
    method: "POST",
    body: JSON.stringify({ accountId, csv }),
  })
}

export interface ConversationalAutomation {
  enableWelcomeMessage?: boolean
  prompts?: string[]
  commands?: { commandName: string; commandDescription: string }[]
}

// Backend returns the fields flat (NOT wrapped in `{ data }`) — it maps Meta's
// snake_case response to these camelCase fields.
export async function getWhatsappConversationalAutomation(
  accountId: string,
  phoneNumberId: string
): Promise<ConversationalAutomation> {
  return apiRequest<ConversationalAutomation>(
    WHATSAPP_ENDPOINTS.CONVERSATIONAL_AUTOMATION(accountId, phoneNumberId)
  )
}

export async function updateWhatsappConversationalAutomation(details: {
  accountId: string
  phoneNumberId: string
  enableWelcomeMessage: boolean
  prompts: string[]
  commands: { commandName: string; commandDescription: string }[]
}): Promise<unknown> {
  return apiRequest<unknown>(WHATSAPP_ENDPOINTS.CONVERSATIONAL_AUTOMATION(details.accountId, details.phoneNumberId), {
    method: "POST",
    body: JSON.stringify(details),
  })
}

// Lists every WhatsApp number the user has actually completed registration
// for, across all of their linked Facebook accounts. Backed by our own DB
// (fast, no live Graph round-trip) rather than the live Meta WABA list used
// during onboarding.
export async function getAvailableWhatsappContexts(): Promise<WhatsappContext[]> {
  const accountsRes: any = await getFacebookAccounts()
  const accounts = Array.isArray(accountsRes) ? accountsRes : accountsRes?.data
  const facebookAccounts = (accounts || []).filter((a: any) => a.type === "facebook")

  const perAccount = await Promise.all(
    facebookAccounts.map(async (account: any) => {
      try {
        const res: any = await listWhatsappPhoneNumbers(account.id)
        const numbers = Array.isArray(res) ? res : res?.data
        return (numbers || [])
          .filter((n: any) => n.status === "registered")
          .map((n: any) => ({
            accountId: account.id,
            wabaId: n.wabaId,
            phoneNumberId: n.phoneNumberId,
            displayPhoneNumber: n.displayPhoneNumber,
            verifiedName: n.verifiedName,
          }))
      } catch {
        return []
      }
    })
  )

  return perAccount.flat()
}

export function getActiveWhatsappPhoneNumberId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_PHONE_NUMBER_KEY)
}

export function setActiveWhatsappPhoneNumberId(phoneNumberId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_PHONE_NUMBER_KEY, phoneNumberId)
}

// Resolves which WhatsApp number is "active" for chat/templates: the user's
// last-picked number if it's still registered, otherwise falls back to the
// first available one (and persists that as the new pick).
export async function getActiveWhatsappContext(): Promise<WhatsappContext | null> {
  const contexts = await getAvailableWhatsappContexts()
  if (contexts.length === 0) return null

  const savedId = getActiveWhatsappPhoneNumberId()
  const active = (savedId && contexts.find((c) => c.phoneNumberId === savedId)) || contexts[0]
  setActiveWhatsappPhoneNumberId(active.phoneNumberId)
  return active
}