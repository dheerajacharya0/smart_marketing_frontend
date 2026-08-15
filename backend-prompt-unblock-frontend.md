# Backend work: three endpoints blocking frontend features

Three unrelated frontend features are built-out-as-far-as-possible and blocked
on backend data. Each is independent — ship in any order, or split across
people. Written against the repo at `D:\backend-wb` and re-verified on
2026-08-15 against `910e41f` (automation rule engine) — none of the three exist
yet; every file, helper and line reference below was checked against that
commit.

Standing constraints for all three:

- Schema is migration-managed (`synchronize: false`). Any new column or index
  needs a hand-written migration in `src/migrations/` with a `name` property and
  a true inverse `down()`.
- Auth is httpOnly cookie (`access_token`), `credentials: "include"`. No Bearer
  header. All new routes go behind the same guard as their sibling routes.
- Every new route is account-scoped and must resolve ownership through the
  existing helper for its module (`resolveOwnedAccount`,
  `resolveOwnedContact`, …) before touching data. Do not trust `accountId` from
  the query string on its own.
- Ship tests alongside. The billing one especially — it does money math.

---

## 1. `GET /billing/estimate` — pre-broadcast cost estimate

**Why:** Cost is invisible until after you send. A small business pressing
"Send" on a 4,000-recipient broadcast currently has no idea whether that costs
₹400 or ₹4,000, and the wallet only tells them afterwards. This is the single
most-requested missing piece of the billing surface.

**What exists already** (`src/billing/billing.service.ts`) — reuse it, don't
reimplement:

- `metaCost(country, category)` → `rates.get(`${country}:${category}`) ??
  rates.get(`DEFAULT:${category}`) ?? defaultRateMicros`
- The two-step markup, exactly as in `recordUsage`:
  ```ts
  const costMicros   = applyMarkup(baseMicros, this.inputTaxPercent); // our real cost
  const chargeMicros = applyMarkup(costMicros, this.markupPercent);   // what we charge
  ```
  Markup compounds **over** input tax on purpose — read the comment on
  `inputTaxPercent` before touching this.
- `countryFromPhone(waId)` in `src/billing/country-from-phone.ts`
- Config: `BILLING_MARKUP_PERCENT` (20), `BILLING_INPUT_TAX_PERCENT` (18),
  `BILLING_CURRENCY` (INR), `BILLING_DEFAULT_RATE_MICROS` (8000000)

**Audience must be resolved with the same query the real send uses**, or the
estimate silently disagrees with the invoice. That logic is
`src/campaigns/campaigns.service.ts#create` ~lines 170-206 (the
`audienceTag` XOR `segmentId` block, ending at the `optedIn` filter):

- `segmentId` set → `segmentsService.buildMemberQuery(accountId, segment.rules)`
- else contacts for the account, optionally `tags @> [audienceTag]`
- always `.andWhere('contact."optedIn" = true')`

Extract that into a shared method (e.g. `resolveAudienceQuery`) and call it from
both `create()` and the estimate. Do not copy-paste it — two copies will drift,
and the drift is a billing discrepancy.

**Request** — mirrors campaign creation:

```
GET /billing/estimate
  ?accountId=<uuid>
  &templateName=<string>
  &templateLanguage=<string>
  &audienceTag=<string>      // optional, mutually exclusive with segmentId
  &segmentId=<uuid>          // optional
```

Reject `audienceTag` + `segmentId` together with 400, same as `create()`.

**Response:**

```jsonc
{
  "currency": "INR",
  "recipientCount": 4210,
  "totalMicros": "3789000000",     // string — bigint, do not send as JS number
  "category": "MARKETING",         // template category the estimate priced on
  "byCountry": [
    { "country": "IN", "count": 4012, "unitMicros": "860000", "subtotalMicros": "3450320000" },
    { "country": "US", "count": 198,  "unitMicros": "1712000", "subtotalMicros": "338976000" }
  ],
  "walletBalanceMicros": "1200000000",
  "sufficientBalance": false
}
```

`byCountry` matters — it's what explains to a user why 200 international
contacts cost more than 4,000 domestic ones.

**Three honesty requirements. The frontend will label this an estimate; the
backend must not make it look more certain than it is:**

1. **Price on the template's category, and say so.** Actual billing uses
   `pricing.category` off Meta's status webhook, and Meta re-categorises
   templates on its own. Return the category used so the frontend can caveat it.
2. **Do not attempt to subtract already-open 24-hour windows.** A contact with an
   open conversation in the same category may not be charged again, so the
   estimate is an upper bound. Trying to predict this is guesswork; being a
   documented upper bound is honest and useful. Say which it is in the field
   docs.
3. **Never round to a "nice" number.** Return micros as a string and let the
   frontend format.

**Do not** create a wallet entry, reserve funds, or write anything. This is a
pure read. `sufficientBalance` is advisory — enforcement stays where it is
(`BILLING_ENFORCE`).

**Tests:** unit-test the per-country grouping and the markup chain against
`billing.service.spec.ts`'s existing style. Include a case where the rate card
has no row for a country (falls to `DEFAULT:`), and one where it has neither
(falls to `defaultRateMicros`).

---

## 2. Contact activity index — `GET /contacts/:id/activity`

**Why:** The contact profile page (`/dashboard/contacts/[contactId]`) shows
identity, consent and message history. It cannot show "which campaigns and
drips has this person been in", because there is no reverse index: sends are
only queryable per-campaign (`listCampaignRecipients`) and per-drip
(`listDripEnrollments`). Assembling it client-side means fanning out across
every campaign and drip on the account, so the frontend ships without it rather
than shipping something slow or fabricated.

**Request:**

```
GET /contacts/:id/activity?accountId=<uuid>&limit=50&offset=0
```

Resolve ownership via the existing `resolveOwnedContact` — the same helper
`contacts.service.ts#get` uses.

**Response** — one merged, reverse-chronological list:

```jsonc
{
  "items": [
    {
      "kind": "campaign",
      "at": "2026-08-02T09:14:22.000Z",
      "campaignId": "…",
      "campaignName": "August offer",
      "status": "read",              // CampaignRecipientStatus
      "errorCode": null,
      "errorTitle": null
    },
    {
      "kind": "drip",
      "at": "2026-07-28T06:00:00.000Z",
      "dripId": "…",
      "dripName": "Onboarding",
      "status": "active",            // DripEnrollmentStatus
      "stepIndex": 2
    }
  ],
  "total": 37
}
```

**Implementation notes:**

- Both sides are keyed by contact already: `CampaignRecipient` has a
  `contactId` column and `DripEnrollment` has one too, so the lookup is by id,
  not by `waId`.
- **Both need an index for this query and neither has a usable one.**
  `campaign_recipient` indexes `['campaign','status','nextAttemptAt']`,
  `['status','sentAt']`, `campaign`, `status` and `waMessageId` — nothing on
  `contactId`. `drip_enrollment` has `['sequenceId','contactId','status']`,
  where `contactId` is not the leading column, so a contact-first lookup can't
  use it. Add `(contactId)` (or `(accountId, contactId)`) on both in the
  migration. Without it this endpoint degrades as soon as an account has real
  campaign volume, which is exactly when someone opens a contact profile.
- Merge and sort in SQL (`UNION ALL` + `ORDER BY`), not in JS after fetching
  both fully — otherwise `limit`/`offset` are wrong.

---

## 3. Binary media upload — inbox drag-and-drop

**Why:** Sending media in the inbox currently requires pasting a public URL.
That is unusable for a non-technical user with a photo on their phone. Meta
supports uploading bytes and getting back a `mediaId`; the send path already
accepts one.

**What exists** (`src/wassup/`):

- `wassup.controller.ts` — `POST send-media`, `GET media/:mediaId`,
  `GET media/:mediaId/download`
- `message-payloads.ts#buildMediaPayload` already takes `link` **XOR**
  `mediaId`, and throws `BadRequestException` if both or neither are given

So the send half is done. What's missing is getting a `mediaId` in the first
place.

**Verified:** `wassup.service.ts` has no upload path — its only media methods
are `getMediaInfo` (metadata for an *inbound* media id) and the download proxy
that fetches Meta's URL with the access token. Nothing wraps
`POST /{phone-number-id}/media`, so this really is new code, not an exposure of
something already there.

**What to add:**

```
POST /wassup/media
  multipart/form-data: file=<binary>, accountId=<uuid>, phoneNumberId=<string>
  → { "mediaId": "…", "mimeType": "image/jpeg", "fileSize": 184320 }
```

Proxies to Meta's `POST /{phone-number-id}/media` with
`messaging_product=whatsapp`. The returned `mediaId` then flows into the
existing `send-media` path unchanged.

**Enforce server-side, not just in the frontend:**

- **Size and type caps per Meta's limits** (images 5MB, documents 100MB, audio
  16MB, video 16MB, stickers 100KB). Reject over-limit before forwarding, with
  a message naming the actual limit — a 400 from Graph mid-upload is a bad
  experience and wastes the transfer.
- **Sniff the content type from the bytes**, don't trust the client's
  `Content-Type` header or the filename extension. A caller can claim
  `image/jpeg` for anything.
- **Cap the request body** at the module level so a huge upload can't exhaust
  memory before validation runs.
- Media ids are scoped to a phone number — validate the caller owns the
  `phoneNumberId` they passed, through the usual ownership resolution.

---

## Summary of what the frontend does once each lands

| Backend | Frontend unblocked |
|---|---|
| `GET /billing/estimate` | Cost preview on the campaign composer before Send; "this exceeds your balance" warning |
| `GET /contacts/:id/activity` | Campaign + drip history on the contact profile — the one documented gap on that page |
| `POST /wassup/media` | Drag-and-drop attachments in the inbox, replacing the paste-a-URL flow |

None of the three needs a frontend change to land first. Ping when one is
merged and I'll wire it.
