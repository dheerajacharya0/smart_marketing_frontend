/**
 * What the owner is told when a Shopify connection comes back failed. The
 * backend's callback redirects here with `?shopify=error&error=<code>`; each
 * code names something the owner can act on.
 */
export function describeShopifyError(
  code: string | null,
  ctx: { storeCurrency?: string | null; accountCurrency?: string | null } = {}
): string {
  switch (code) {
    case "currency_mismatch":
      return ctx.storeCurrency && ctx.accountCurrency
        ? `Your store sells in ${ctx.storeCurrency} but this account bills in ${ctx.accountCurrency}. Sales in another currency can't be added up, so the store wasn't connected.`
        : "Your store sells in a different currency from this account, so it wasn't connected."
    case "store_taken":
      return "That store is already connected to another account. Disconnect it there first."
    case "expired":
      return "The connection took too long to approve. Start again from this page."
    case "shopify_refused":
      return "Shopify didn't grant access. Try connecting again, and approve the request on Shopify."
    case "invalid_request":
      return "That approval couldn't be verified. Start the connection again from this page."
    default:
      return "Couldn't connect to Shopify. Try again in a minute."
  }
}
