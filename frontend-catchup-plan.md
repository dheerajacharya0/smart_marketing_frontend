# Frontend catch-up plan — backend `32c7d1f`

Audit of `D:\backend-wb` at `32c7d1f`, against this repo at `9262382`. Twenty-two
feature commits landed since the last sync point (`910e41f`), ~17.5k lines. This
is what they mean for the frontend, worst-first.

**Re-checked 2026-08-17:** backend `main` is still `32c7d1f` with a clean tree —
nothing has merged since this audit, so everything below still stands as
written. One branch is in flight and not merged: `origin/feat/output-gst`
(`4da8f2c`), which adds four billing routes — see "In flight" at the bottom.
Don't build against it until it lands on `main`.

Two things are **not** in that list because the backend still hasn't built them —
both asks from `backend-prompt-unblock-frontend.md` are still open:

- `GET /billing/estimate` — no route. `BillingService.estimateSendCostMicros`
  now exists and `POST /campaigns` **returns** `estimatedCost` /
  `estimatedCostMicros` in its response, so a *post-create* figure is available;
  a *pre-send* preview on the composer still has nothing to call.
- `GET /contacts/:id/activity` — no route. Contact profile still can't show
  campaign/drip history.

`POST /wassup/media` (task 3) **did** land — see item 6.

---

## Tier A — we are wrong right now

These are shapes the frontend already sends or renders, where the backend has
moved. Ordered by how visibly each one misleads someone.

### A1. Campaign status gained `paused` (+ pause/resume routes) — **DONE**

`CampaignStatus` in `services/api.ts:1776` is still
`"scheduled" | "running" | "completed" | "cancelled"`. The backend added a real
`paused` status — deliberately a status, not a deferral modifier, because a
paused campaign has been stopped by a human while a deferred one wants to send
and can't.

Work: extend the union; `CampaignStatusBadge` needs a paused case (distinct from
both "Running" and the two deferral badges); status filters on the campaigns
list; `POST /campaigns/:id/pause` and `/resume` wired to buttons on the detail
page; the analytics `byStatus` block gains a `paused` bucket (the backend added
one — a status with no bucket silently inflates the total).

### A2. Segment rules: nested groups, static segments, `clicked` — **DONE**

Three changes at once in `src/segments/`:

- Rules are now **recursively nestable** — any member of a group may itself be a
  group, tagged `type: 'group'`. Our `lib/segment-rules.ts` builds one flat
  `{ combinator, conditions }`, which is still valid (it is exactly a group with
  no nesting), so we are not broken — but a segment built elsewhere with nesting
  will not round-trip through our builder.
- `SegmentType` is `'dynamic' | 'static'`. A static segment has `rules: null`
  and explicit membership via `POST /segments/:id/members` and
  `/members/remove`. Our segments list and builder assume every segment has
  rules.
- Campaign-behaviour conditions gained a `clicked` event (alongside
  received/read/replied), backed by `CampaignRecipient.clickedAt`.

Work: mirror the recursive schema in `lib/segment-rules.ts` (+ tests), nested
group UI in `segment-builder.tsx`, a static-segment path (create, add/remove
members, and a list that doesn't offer rule editing for one), and `clicked` in
the condition options.

### A3. Flow definitions gained `condition` and `delay` nodes — **DONE**

`lib/flow-validation.ts` and `flow-builder.tsx` know five node types
(message/buttons/question/handoff/end). The backend added two:

- `condition` — an ordered list of branches (variable, operator, optional value,
  next) plus `defaultNext`; first match wins, nothing is sent. Comparisons are
  trimmed and case-insensitive; numeric operators are *false* rather than an
  error when either side isn't a number; there is deliberately no regex
  operator.
- `delay` — parks the session on a timer, capped at 24 hours. `FlowSession`
  gained `resumeAt`, and **its presence, not the status, is what distinguishes
  "waiting on a timer" from "waiting on a reply"** — status stays `active`
  through a delay so a second session can't open for the same contact.

Validation also now rejects synchronous cycles (message ↔ condition) while
allowing a loop that passes through a delay.

Work: both node types in the type union, the validator, the builder, and the
simulator; render `resumeAt` in the sessions view. Note our starter flows in
`lib/flow-starters.ts` are still valid — nothing was removed.

### A4. Chat: per-agent unread and per-member visibility — **DONE**

- `conversation_read_state` holds a read **cursor** per (conversation, user).
  The conversations list now returns a **viewer-scoped** `unreadCount`; the
  row's own shared counter is legacy-but-maintained precisely so an unmigrated
  frontend doesn't break. We are that unmigrated frontend
  (`hooks/use-whatsapp-conversations.ts:38`, `components/chat-sidebar.tsx:170`).
- `GET /chat/conversations/unread` is the badge total, built on the same
  visibility scoping.
- `AccountMember.conversationScope` restricts which conversations a member can
  see at all (own / unassigned_and_own / all).

Work: read the viewer-scoped count, use the new endpoint for the sidebar badge
instead of summing client-side, and surface `conversationScope` in team
management (see B5) so an admin can tell why a teammate sees less.

### A5. Drip exit conditions and template header media — **DONE**

- `DripSequence.exitConditions` (jsonb, default `[]`) ends an enrollment early
  on a reply, a button tap, or a tag change. Empty = old behaviour, so nothing
  is broken — but the builder can't set it, and "why did this contact keep
  getting messages after they replied" is the question it answers.
- Campaign and drip template sends accept `headerMedia`
  (`image | video | document`, `link` XOR `mediaId`, optional `filename`).
  Neither builder offers it.

---

## Tier B — built on the backend, no frontend at all

### B1. Contact tags endpoint — **DONE**

`GET /contacts/tags` returns `{ tag, count, optedInCount }[]` — a real DISTINCT
over all contacts. Both `segment-builder.tsx` and the automation editors
currently derive tags from a **sample of 100 contacts**, which silently omits
tags that only exist further down the list. Replace the sample; keep it as a
fallback the way `attribute-keys` does.

### B2. Binary media upload → inbox drag-and-drop — **DONE**

`POST /whatsapp/media` (multipart: `file` + `type`) returns a media id valid for
30 days; per-category Meta ceilings are enforced server-side on top of a global
`MEDIA_UPLOAD_MAX_BYTES` (16MB default). This closes the long-standing inbox gap
— sending media no longer requires pasting a public URL — and also feeds the
`headerMedia` pickers from A5.

### B3. Click tracking and CTR — **DONE**

`POST /links` / `GET /links` create and list tracked links; `/r/:token` is the
public redirect (302 on purpose, so every click is counted). Campaign sends
rewrite bare-URL template parameters automatically. Analytics gained
`clickedCount` and `clickRate`.

Work: CTR on the campaign detail tiles and the dashboard, a clicked column in
recipients, and the `clicked` segment condition from A2.

### B4. Revenue attribution — **DONE (analytics half)**

`POST /conversions` (idempotent on `(accountId, externalId)`, guarded by
`ApiKeyOrJwtGuard` so the dashboard and an integration share one handler),
`GET /conversions`, `POST /conversions/:id/void` (a refund is a void, never a
delete). `GET /analytics/overview` gained a `revenue` block with an
attributed/total split; `GET /analytics/campaigns/:id` gained revenue, cost and
`roas` — **null rather than 0** when nothing was charged.

Work: revenue + ROAS on analytics, a conversions list with void, and an
integration screen explaining how a store posts orders. Honesty constraint to
carry over: attribution is last-touch inside a 7-day window and the model is
stored per row — don't present it as ground truth, and don't recompute it
client-side.

### B5. Team invites and conversation scope — **DONE**

`POST /team/invites` (email, optional role + conversationScope), `GET`,
`DELETE /:id`, `POST /invites/accept`. The plaintext token exists exactly once,
in the create response, so the UI **must** offer to copy the link at that moment
— it cannot be re-fetched. Invites expire in 7 days; every rejection returns one
identical message on purpose, so don't try to explain *why* one failed.

Work: invite dialog + outstanding-invites list with derived status, revoke, and
the scope selector on both invite and member edit.

### B6. Customer API keys

`POST /api-keys` (name, tier, optional rate override), `GET /api-keys`,
`GET /api-keys/usage`, `DELETE /api-keys/:id`. `app/dashboard/api-usage/page.tsx`
currently shows message volume because that was all the backend measured — real
per-key call counts now exist, which is the page that screen was always meant to
be. Same one-time-secret rule as invites.

### B7. WhatsApp Flows (Meta native) — the big one

Eleven routes under `/whatsapp-flows`: create, list, get, set definition,
publish, deprecate, sync, delete, send, list responses, plus `keys/status` and
key upload for endpoint (`data_api`) flows with Meta's hybrid encryption. This
is a whole product surface — a form builder, a lifecycle (draft → published →
deprecated), a response inbox, and key management.

Deliberately last: it is the largest by an order of magnitude, and it is the
only item here that nothing existing depends on.

### B8. Billing markup admin

`GET /billing/markup`, `PATCH /billing/markup` (per account),
`PATCH /billing/markup/global`. Admin-only. `WalletEntry.markupPercent` is now
stored per entry, so historical charges keep the rate they were billed at —
whatever UI we build must read the stored value, never re-derive.

---

---

## In flight — not merged, don't build yet

### `origin/feat/output-gst` (`4da8f2c`) — GST on top-ups

Adds `GET`/`PATCH /billing/tax-profile` and `GET /billing/invoices`,
`GET /billing/invoices/:id`, plus a tax breakdown snapshotted onto every
top-up order. When it merges, the frontend work is three pieces:

- **Top-up dialog.** GST is added **at checkout, not carved out of the top-up**:
  `TopupOrder.amountMicros` stays wallet credit and the new `grossMicros` is
  what the card is charged, so a ₹1,000 top-up still buys ₹1,000 of sending and
  the customer pays ₹1,180. The dialog has to show both numbers and the tax
  lines, or the Razorpay sheet will quote a figure the user never agreed to.
  Note the split is CGST+SGST intra-state, IGST inter-state, 0% (zero-rated
  export) outside India — render whichever lines the order actually carries
  rather than assuming a single "GST" row.
- **Invoices.** A list on the billing page reading `GET /billing/invoices`, and
  a detail view. Numbers are `INV/<financial-year>/<seq>` allocated at
  settlement, so an abandoned order has none — a pending top-up must not render
  a blank invoice number as if one existed.
- **Tax profile form** in settings: taxCountry, taxState, GSTIN, legal name,
  billing address. A GSTIN outranks the state field server-side, so if both are
  present and disagree, the form should say which one the invoice will follow.

Everything on the invoice is snapshotted at settlement because rates change —
same reasoning as `WalletEntry.markupPercent`. Whatever we render must come from
the stored breakdown, never be recomputed client-side from today's rate.

---

## Suggested order

1. ~~**A1, A4**~~ — **done.** Campaign pause/resume with its own badge and
   polling rule; viewer-scoped unread with a server-computed sidebar badge, and
   conversation scope on the team screen (offered for agents only, since the
   server resolves an admin to `all` whatever is stored).
2. ~~**B1**~~ — **done.** All five builders now read `GET /contacts/tags`
   instead of sampling 100 contacts.
3. ~~**A5 + B2**~~ — **done.** Upload-or-link attachment dialog, drop-to-attach
   on the thread, a shared header-media field for campaigns and drip steps, drip
   stop conditions, and an exit-reason column on enrollments.
4. ~~**A2, A3**~~ — **done.** Recursive rule editor, static segments end to end,
   and `clicked`; branch/wait nodes in the flow builder, validator and
   simulator, with `resumeAt` on the sessions view.

**Tier A is now closed** — nothing the frontend sends or renders disagrees with
the backend. What's left is all net-new surface (B3 onward).
5. ~~**B3, B4**~~ — **done** for the analytics half: CTR tiles and a clicked
   column, revenue/ROAS on campaign detail, and an attributed-vs-total revenue
   card on the dashboard. Still open under B4: a conversions list with void,
   and an integration screen documenting how a store posts orders.
6. **B5, B6, B8** — admin surfaces.
7. **B7** — WhatsApp Flows, on its own.

The GST work slots in beside B8 whenever `feat/output-gst` merges; it touches
the same billing screens, so doing both in one pass avoids rebuilding the
top-up dialog twice.
