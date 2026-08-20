# Backend work: the Meta access token is in API responses

Found while testing the flow canvas end to end on 2026-08-20 against
`D:\backend-wb` at `188503d`. Not related to the canvas — it shows up on any
endpoint that returns an entity with its `account` relation attached.

## What happens

`POST /flows` returns the created flow **with the whole `Account` row embedded**:

```json
{
  "id": "e5ffa938-…",
  "account": {
    "id": "7283afc5-…",
    "accessToken": "EAAJSOB1WkpIBSFiO2wUz8H9pZCiIjgP4njw…",
    "whatsappPin": null,
    "walletBalanceMicros": "996741502",
    "facebookBusinessDetails": { "businessId": "2115142398901830", … },
    …
  },
  …
}
```

That is a real captured response from the running server, trimmed. The token is
the long-lived Meta credential for the WABA: whoever holds it can send messages,
read templates, and call Graph as the customer's business until it expires.

The column is encrypted at rest (`encryptedTokenTransformer`,
`src/auth/facebook-account.entity.ts:24-29`) — and the transformer decrypts on
read, so the plaintext goes out over the wire. The at-rest encryption is doing
its job and is then undone by the response shape.

## Why it matters more than "it's the user's own token"

The response is readable by anything with the session: an XSS on the dashboard,
a browser extension, a devtools screenshot pasted into a ticket, an intermediate
proxy, or a log that captures response bodies. None of those should be enough to
take over the WhatsApp number. The frontend never asks for the token and has no
use for it.

## Where it comes from

`Account` has no `@Exclude()` on the sensitive columns
(`accessToken` `:24-29`, `whatsappPin` `:37-42`), and there is no
`ClassSerializerInterceptor` registered in `src/main.ts` or `src/app.module.ts`
— so whatever a handler returns is serialized as-is.

Services build an entity with the resolved account object and return what
`repo.save()` gives back, which still carries that object:

- `src/flows/flows.service.ts#create` — **verified leaking**
- `src/flows/flows.service.ts#update` — same, via `resolveOwnedFlow`
- `src/segments/segments.service.ts:142` — same `account,` shape
- `src/campaigns/campaigns.service.ts:290` — same
- `src/drips/drips.service.ts:96` — same

Please treat that list as a starting point, not a complete audit: the pattern is
"handler returns an entity that has a loaded `account` relation", and a grep for
`relations: ['account'…]` finds more call sites (several are internal to
dispatchers and never reach a response — those are fine).

## What to do

Both layers, not one:

1. **Stop serializing the secrets at all.** Put `@Exclude()` on `accessToken`
   and `whatsappPin`, and register `ClassSerializerInterceptor` globally:

   ```ts
   app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
   ```

   This is the backstop that makes the next leak of this shape impossible.
   Check it doesn't change existing response shapes: the interceptor only
   transforms class instances, so plain-object responses are untouched, but
   entities that currently serialize every column will start honouring
   decorators.

2. **Don't return the relation in the first place.** A flow response has no
   reason to carry an account: strip it in the service (`{ ...flow, account:
   undefined }`) or return an explicit response shape. This is the fix that
   keeps wallet balance, GSTIN, and `facebookBusinessDetails` out of a flow
   response too — none of which `@Exclude()` covers, and none of which the
   caller asked for.

Consider `@Column({ select: false })` on `accessToken` as a third layer so it
isn't even loaded unless a query asks for it — but only if the paths that
genuinely need it (the dispatchers, the Graph client) can be moved to an
explicit `addSelect`. Worth checking, not worth breaking sends over.

## Tests

- An e2e assertion that a `POST /flows` response body contains no
  `accessToken` — and, better, a shared helper asserting no response in the
  suite contains that key, so the next endpoint with this shape fails in CI.
- A unit test that `instanceToPlain(account)` omits both secret columns.

## Not blocking the frontend

Nothing in the frontend reads `account` off these responses, so this can ship
whenever — it just shouldn't sit around. Ping when it lands and I'll re-check
the flow endpoints from the browser.
