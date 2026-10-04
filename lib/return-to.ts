/**
 * A `returnTo` query value we're willing to navigate to: a path inside the
 * dashboard and nothing else. Anything that could leave the site — a full
 * URL, a protocol-relative `//host`, a backslash some browsers read as `/` —
 * is dropped, so the parameter can't be turned into an open redirect.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith("/dashboard/") && value !== "/dashboard") return null
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null
  return value
}

/** Where to create a template, coming back to `returnTo` once it's submitted. */
export function createTemplateHref(returnTo?: string): string {
  const params = new URLSearchParams({ new: "1" })
  const safe = safeReturnTo(returnTo)
  if (safe) params.set("returnTo", safe)
  return `/dashboard/templates?${params.toString()}`
}
