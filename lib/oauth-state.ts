/**
 * CSRF `state` for the redirect-based Facebook OAuth flow.
 *
 * The backend builds the login URL with a constant `state` and does not verify
 * it on the callback, so the check has to live here. Without it, an attacker can
 * feed the user a link carrying *their* authorization code — the app would
 * happily exchange it and bind the attacker's Facebook account to the victim's
 * session (authorization-code injection).
 *
 * We overwrite the URL's `state` with a random nonce kept in `sessionStorage`
 * (per-tab, cleared when the tab closes — a redirect stays in the same tab) and
 * require the value coming back to match, exactly once.
 *
 * This applies to the *redirect* flow only. Embedded Signup gets its code
 * through an SDK callback in a popup, never off a URL, so there is no
 * attacker-supplied parameter to smuggle a code in through.
 */

const STORAGE_KEY = "fb_oauth_state"

function randomNonce(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }
  // No Web Crypto — refuse rather than fall back to Math.random, which would
  // look like protection while being guessable.
  throw new Error("Secure random values are unavailable in this browser")
}

/**
 * Stamp a fresh nonce onto a backend-provided Facebook login URL, replacing the
 * placeholder `state` it ships with. Returns the URL to navigate to.
 */
export function withOAuthState(loginUrl: string): string {
  const nonce = randomNonce()
  sessionStorage.setItem(STORAGE_KEY, nonce)
  try {
    const url = new URL(loginUrl)
    url.searchParams.set("state", nonce)
    return url.toString()
  } catch {
    // Not a parseable absolute URL — don't navigate somewhere half-built.
    sessionStorage.removeItem(STORAGE_KEY)
    throw new Error("Facebook login URL was malformed")
  }
}

/**
 * Verify the `state` echoed back by Facebook. Single-use: the stored nonce is
 * cleared whether or not it matched, so a replayed callback fails too.
 *
 * Returns false when there is nothing stored — a callback arriving in a tab that
 * never started the flow is exactly the attack this guards against.
 */
export function consumeOAuthState(received: string | null): boolean {
  const expected = sessionStorage.getItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  return Boolean(expected) && Boolean(received) && expected === received
}
