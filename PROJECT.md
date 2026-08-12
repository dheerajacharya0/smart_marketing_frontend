# WhatsApp Marketing Tool — Project Guide

Single source of truth for the whole application: what it does today (product +
features), what's planned (design revamp + roadmap), and how we harden and scale
the engineering underneath it.

**This document has two parts:**

- **Part 1 — Product & Features** — every feature in plain English with a business
  example, the design-revamp plan, backend↔frontend gaps, the future roadmap, and
  the convention for adding new features.
- **Part 2 — Frontend Infrastructure & Hardening Plan** — the phased, no-break
  plan to take the frontend from prototype-grade infra to world-class
  (types, CI, auth, security, error handling, architecture, tests).

> Maintenance rule: keep this file current. New feature → add it under Part 1
> using the feature template. New infra/hardening decision → update Part 2.

---

# Part 1 — Product & Features


A plain-English tour of everything the product does today, with a real business
example for each feature, plus what's missing or worth improving — especially to
make the tool approachable for a first-time WhatsApp marketer.

> Legend: **[Live]** = built and wired to the backend · **[Placeholder]** =
> screen exists but shows static/mock data · **[Gap]** = not built yet.
>
> Design status: **[Revamped]** = new design system applied · **[Planned]** =
> design revamp scoped below, not yet built.

---

## Design Revamp Plan — whole application

The auth flow (section 1) is the reference implementation for a **product-wide
visual + UX revamp**. Goal: turn a functional-but-dense internal tool into a
polished, confidence-inspiring product a non-technical small-business owner can
navigate without training. Every section below carries a **Design revamp**
note describing how the new system applies to that surface.

### Design language

- **Brand:** WhatsApp green (`--primary` / `--whatsapp`) as the action/success
  color, Facebook blue (`--facebook` / sidebar tokens) as the structural/nav
  accent. `brand-gradient` (green→blue) for hero and empty-state moments only —
  never behind dense data.
- **Surfaces:** HUD panel system already in `globals.css` — `hud-panel`,
  `hud-strip`, `hud-stat`, `hud-label`, `hud-value`, `hud-row`, `hud-glow`.
  Low-noise, subtle blur, mono tabular numbers for all metrics. This is the
  default for stat rows and data cards across the app.
- **Type:** `responsive-heading` / `responsive-subheading` scale, mono
  (`font-mono tabular-nums`) for every number, count, and metric.
- **Density:** two modes — comfortable (default, newbie-friendly) and compact
  (power users, toggled in settings). Tables use `responsive-table` with
  `hide-on-lg` / `hide-on-md` / `hide-on-sm` column priorities.
- **Dark mode:** first-class — every new component styled for both themes using
  the existing token set. No hard-coded colors.
- **Motion:** 150–200ms ease transitions (`whatsapp-card`, `sidebar-item`);
  respect `prefers-reduced-motion`.
- **Fully responsive & device-agnostic (non-negotiable):** every screen must
  work and look right on **mobile, tablet, desktop, and any viewport in
  between** — no horizontal scroll, no cut-off controls, no desktop-only
  layouts. Mobile-first, built on the existing responsive utilities
  (`responsive-container`, `responsive-heading`, `responsive-flex`,
  `card-grid`, `p/px/py-responsive`, `btn-responsive`) plus Tailwind
  `sm/md/lg/xl` breakpoints. Touch targets ≥44px, tap-friendly spacing.
  - **Adaptive layouts:** sidebar collapses to a drawer/bottom-nav on mobile;
    multi-pane screens (inbox, flow canvas) stack to one pane at a time with
    back navigation; tables switch to card lists or use `hide-on-lg`/`-md`/
    `-sm` column priorities via `responsive-table`.
    Wizards (`Stepper`) go vertical/step-at-a-time on narrow screens.
  - Test matrix every feature ships against: 360px phone, 768px tablet,
    1280px+ desktop, portrait **and** landscape. Also honor safe-area insets
    and dynamic viewport height (`dvh`) on mobile browsers.

### Shared primitives to build (used by every feature)

These are the revamp's reusable building blocks — build once, apply everywhere:

- `PageHeader` — title, subtitle, breadcrumb, action slot, active-number badge.
- `StatStrip` — wraps `hud-strip`/`hud-stat` for headline metrics.
- `EmptyState` — icon, plain-language explainer, primary CTA, "learn more"
  link. Replaces every blank list/table across the app.
- `DataTable` — sortable, filterable, paginated, responsive-column table on top
  of `responsive-table`, with row-skeleton loading and empty slot.
- `JargonTooltip` / `<Glossary>` — inline plain-language explainers for every
  Meta term (WABA, phone number ID, quality rating, messaging tier, opt-in).
- `Stepper` — shared progress/wizard chrome (already partly in
  `whatsapp-integration-stepper.tsx`); reused by onboarding, campaign, and
  import wizards.
- `PresetGallery` — clone-in-one-click cards for templates, segments, flows.
- `CostBadge` — estimated WhatsApp conversation spend, shown before any send.
- Toast/inline-alert, skeleton loaders, and confirm-dialog conventions,
  standardized (replace ad-hoc `use-toast` removal fallout).

### Cross-cutting UX wins the revamp bakes in

1. **Guided first run** — a global onboarding checklist shell (Connect WhatsApp →
   Import contacts → Send first message) surfaced on the dashboard until done.
2. **Plain language everywhere** — `JargonTooltip` on every Meta term; friendly
   status copy instead of `GREEN`/`TIER_1K`.
3. **Consistent empty/loading/error states** via the shared primitives.
4. **Cost visibility** via `CostBadge` before every broadcast.
5. **Responsive/mobile polish** so agents can work from a phone.

### Rollout phases

- **Phase 0 (done):** design tokens, HUD system, auth revamp (`AuthShell`,
  `PasswordInput`, reset/verify flows).
- **Phase 1 — foundation:** build shared primitives above; apply `PageHeader` +
  `EmptyState` + `DataTable` to dashboard, contacts, campaigns, templates.
- **Phase 2 — engagement surfaces:** inbox, flows, segments, automation — richer
  interactions (drag-drop upload, visual flow canvas, preset galleries).
- **Phase 3 — trust & clarity:** analytics benchmarks, cost previews, number-
  health explainers, guided first-run checklist.
- **Phase 4 — placeholder→live:** redesign billing, notifications, docs, admin
  as their backends land.

---

## 1. Sign up & log in **[Live] [Revamped]**

**What it does:** Email + password accounts. The token is stored and attached to
every backend call; expired sessions bounce to the login screen. A revamped,
world-class auth experience: split-screen layout with a brand story panel, a
segmented sign-in / sign-up switcher, show/hide password toggle, live password
strength meter, and "keep me signed in." Full **password reset** and **email
verification** flows are wired end-to-end.

**Business example:** Priya, who runs a home-bakery, creates an account with her
email, confirms it via the verification link, and lands in the dashboard. Next
month she forgets her password and resets it herself from the login screen.

**Design revamp (implemented):**
- Split-screen `AuthShell` (`components/auth/auth-shell.tsx`) — brand panel with
  gradient, value props, and trust badges on the left; form card on the right.
  Responsive (brand panel hides below `lg`) and dark-mode aware.
- Reusable `PasswordInput` + `PasswordStrength` meter
  (`components/auth/password-input.tsx`).
- Redesigned login/signup forms with inline error alerts and loading states.

**Implemented (was missing):**
- **Forgot / reset password flow** — `app/forgot-password` (request link, generic
  "if that email exists" success) and `app/reset-password` (token from URL,
  strength-gated new password, auto-redirect to login).
- **Email verification** — post-signup "confirm your email" state with resend;
  `app/verify-email` auto-verifies the token with a resend fallback on failure.
- Backend hooks: `FORGOT_PASSWORD`, `RESET_PASSWORD`, `VERIFY_EMAIL`,
  `RESEND_VERIFICATION` endpoints in `config/api-config.ts`; matching
  `requestPasswordReset`, `resetPassword`, `verifyEmail`, `resendVerification`
  service functions in `services/api.ts`. (Server must implement these routes.)

**Still missing / improve for newbies:**
- No guided welcome — a newbie lands on an empty dashboard with no idea what to do
  first.
- Brand name in `AuthShell` is a placeholder ("Wavelength") — swap for the real
  product name.
- **Suggested:** a first-run checklist ("1. Connect WhatsApp → 2. Import contacts
  → 3. Send your first message") that ticks off as they go.

---

## 2. Connect WhatsApp Business (onboarding) **[Live] [Planned]**

**What it does:** A multi-step wizard that links a Meta/Facebook Business account
via Meta's embedded signup, adds a phone number, and registers + verifies it
through Meta (SMS/voice code). Backed by the Facebook OAuth exchange and the
WhatsApp Cloud API.

**Business example:** Priya connects her business's WhatsApp number
(+91 98765 43210) so she can message customers from her brand name, not a
personal chat.

**Missing / improve for newbies:**
- The steps assume the user already understands WABA, phone number IDs, and Meta
  Business Manager — heavy jargon for a beginner.
- No "test message to yourself" step to confirm the number actually works before
  going live.
- **Suggested:** inline explainers ("What's a WABA?"), a progress meter, and a
  sandbox/test send at the end.

**Design revamp (planned):**
- Rebuild the wizard on the shared `Stepper` with a progress meter and a
  per-step `PageHeader` (what/why for each step).
- `JargonTooltip` on WABA, phone number ID, Meta Business Manager — every term
  gets a one-line plain explainer inline.
- Final "send a test message to yourself" step with a success `EmptyState`→
  confirmation, before the number goes live.
- Reuse the `(onboarding)` route group + `hud-panel` cards for a calm,
  low-jargon feel.

---

## 3. Account & number switcher **[Live] [Planned]**

**What it does:** If a user has more than one registered WhatsApp number, a
switcher lets them pick which one they're currently working under. The choice is
remembered and drives contacts, campaigns, chat, etc.

**Business example:** A franchise owner toggles between the "Pune outlet" number
and the "Mumbai outlet" number without logging out.

**Missing / improve:**
- No visual reminder of *which* number is active while deep in a campaign — easy
  to send from the wrong one.
- **Suggested:** always show the active number in the top bar.

**Design revamp (planned):**
- Persistent active-number badge in `PageHeader` / top bar (avatar + name +
  number + quality dot), visible on every screen.
- Switcher as a command-palette-style dropdown with search, quality rating, and
  number status per entry.

---

## 4. Message templates **[Live] [Planned]**

**What it does:** Lists your Meta-approved message templates, lets you create new
ones, and includes an **AI template generator** (describe the message in plain
language, get compliant draft templates back). Only APPROVED templates can be
sent outside the 24-hour window.

**Business example:** Priya generates an "order ready for pickup" template with a
`{{name}}` and `{{pickup_time}}` variable instead of writing Meta-compliant copy
by hand.

**Missing / improve for newbies:**
- Template approval status and *why* a template was rejected isn't explained in
  friendly terms.
- No template categories/use-case gallery to copy from ("abandoned cart",
  "appointment reminder", "festive offer").
- **Suggested:** a starter template library newbies can clone in one click.

**Design revamp (planned):**
- `PresetGallery` of starter templates (abandoned cart, appointment reminder,
  festive offer) — clone in one click, categorized by use-case.
- Approval status as a friendly `DataTable` column with a `JargonTooltip`
  explaining *why* a template was rejected and how to fix it.
- AI generator gets a two-pane compose view: prompt on the left, live WhatsApp
  bubble preview (`chat-bubble-out`) with variable chips on the right.

---

## 5. Contacts (CRM) **[Live] [Planned]**

**What it does:** Your audience list. Add contacts manually or bulk-**import from
CSV**, tag them (`vip`, `retail`), attach custom attributes (city, plan), and
track **opt-in/opt-out** status. Search, filter by opt-in, paginate. Opt-in
source and history are shown (manual / CSV / texted START-STOP).

**Business example:** Priya imports 300 customers from her old spreadsheet,
tags the wedding-cake buyers as `premium`, and sees who's opted in to receive
offers.

**Missing / improve for newbies:**
- No de-duplication preview or column-mapping UI on import — a messy CSV can
  create confusion.
- No "contact profile" view showing full history (messages, campaigns, notes) in
  one place.
- **Suggested:** guided CSV mapping ("which column is the phone number?") and a
  single contact timeline.

**Design revamp (planned):**
- CSV import rebuilt on the shared `Stepper`: upload → column mapping →
  de-dup preview → confirm, each step a `hud-panel` with a live row count.
- Contact list on `DataTable` (tag chips, opt-in dot, responsive columns,
  skeleton loading, `EmptyState` for first run).
- Single **contact profile** drawer/page: timeline of messages, campaigns, and
  notes; opt-in source + history in plain language.

---

## 6. Segments (smart audience filters) **[Live] [Planned]**

**What it does:** Saved, *live* audience rules — e.g. "tag has `vip` AND inactive
for 30 days AND replied to any campaign within 7 days." Membership is recomputed
every time it's used (never a stale list). A live preview shows how many contacts
match as you build. Segments can be picked as a campaign audience.

**Business example:** A gym builds a segment "members in Pune who haven't visited
in 30 days" and blasts them a win-back offer — automatically kept up to date.

**Missing / improve for newbies:**
- The rule builder is powerful but dense; a beginner may not know what "activity
  within" means.
- No ready-made segment templates ("lapsed customers", "new this month", "VIPs").
- **Suggested:** a few one-click preset segments and simpler wording.

**Design revamp (planned):**
- Rule builder redesigned as readable condition chips ("tag **is** vip",
  "inactive **for** 30 days") with plain-language `JargonTooltip` on each
  operator; live match-count via `StatStrip`.
- `PresetGallery` of ready segments (lapsed customers, new this month, VIPs) —
  clone and tweak.

---

## 7. Broadcast campaigns **[Live] [Planned]**

**What it does:** Send a template message to many opted-in contacts at once —
targeted by **all opted-in / a tag / a segment**. A 4-step wizard handles
template pick, per-variable personalization (with `{{name}}` etc. tokens and a
live preview), audience selection with an estimated size, and send-now or
schedule-for-later. Live delivery tracking: sent / delivered / read / replied /
failed / skipped, a read-rate and a funnel, plus a per-recipient table. Cancel a
running or scheduled campaign anytime.

**Business example:** For Diwali, Priya schedules a "20% off festive boxes"
broadcast to her `premium` segment for 9am, then watches 240 of 250 deliver and
180 get read.

**Missing / improve for newbies:**
- No spend/cost estimate — WhatsApp charges per conversation, and beginners have
  no idea what a blast will cost.
- No A/B testing of message variants.
- No "best time to send" guidance or send-rate throttling explanation.
- **Suggested:** show an estimated cost before sending, and warn on risky
  audience sizes.

**Design revamp (planned):**
- 4-step wizard on the shared `Stepper` with a sticky live WhatsApp-bubble
  preview updating as variables are filled.
- `CostBadge` on the audience step: estimated conversation spend + a warning
  banner (`hud-glow`) when the audience is unusually large.
- Live tracking rebuilt on `StatStrip` (sent/delivered/read/replied/failed) +
  the engagement funnel and per-recipient `DataTable`.
- **Surface tier-cap deferral:** the backend now auto-defers a campaign when a
  number hits its daily tier limit (recipients stay `pending`). Show a clear
  "paused — daily limit reached, resumes tomorrow" banner instead of leaving the
  campaign looking stalled.

---

## 8. Analytics dashboard **[Live] [Planned]**

**What it does:** The landing page after login. Date-range picker drives
everything. Shows headline stats (sent, delivered, read, replies, failed with
rates), a campaign status breakdown, an **engagement funnel** (sent → delivered →
read → replied), and a **messaging volume chart** (inbound vs outbound over
time). Per-campaign detail pages add a delivery timeline chart.

**Business example:** Priya sees that her read rate dropped this week and that
inbound replies spike every evening — so she reschedules broadcasts for 7pm.

**Missing / improve for newbies:**
- Numbers without interpretation — a beginner sees "68% read rate" but not
  whether that's good or bad.
- No exports (CSV/PDF) for sharing with a boss/accountant.
- **Suggested:** benchmark hints ("good read rate is 60%+") and one-click export.

**Design revamp (planned):**
- Landing dashboard rebuilt entirely on `StatStrip` + `hud-panel` charts, with
  the guided first-run checklist docked on top until complete.
- Benchmark hints inline under each metric ("68% read rate — good is 60%+")
  via a small `JargonTooltip`/badge pattern, color-coded green/amber.
- Export button (CSV/PDF) in the `PageHeader` action slot.

---

## 9. Team inbox — conversations **[Live] [Planned]**

**What it does:** A shared inbox showing every WhatsApp conversation in real time
(WebSocket). Open a thread to read history and reply with **text, media (image /
video / audio / document / sticker via URL), and interactive messages (reply
buttons & list menus)**. Media renders inline with lazy loading and a lightbox.

**Business example:** A customer messages "is the chocolate cake eggless?" and
Priya replies with a photo and a "Yes / No / Call me" button set — right from the
browser.

**Missing / improve for newbies:**
- Media send takes a **URL, not a file upload** — a newbie expects to drag-drop a
  photo. (Backend file-upload endpoint is the noted follow-up.)
- No canned/quick replies for common questions.
- No emoji picker (button exists but inert).
- **Suggested:** drag-drop upload and a saved quick-replies library.

**Design revamp (planned):**
- Three-pane inbox: conversation list, thread, contact/context panel — full
  `chat-bubble-in`/`chat-bubble-out` styling, dark-mode aware.
- **Drag-drop file upload** zone in the composer (pending backend upload
  endpoint) replacing URL-only media send.
- Quick-replies library popover + a wired emoji picker (button currently inert).

---

## 10. Team management & collaboration **[Live] [Planned]**

**What it does:** Invite teammates to an account as **admin** or **agent**
(owner is implicit). Any member can work all conversations. In the inbox, agents
can **assign/reassign** conversations, **label** them, and leave **internal
notes** only the team sees. Filter the inbox by assignee / unassigned / label.
Role-gated: agents can't manage the team.

**Business example:** Priya hires two part-time helpers; she assigns wholesale
chats to one, retail to the other, labels urgent ones `priority`, and leaves a
note "customer allergic to nuts" that only staff see.

**Missing / improve for newbies:**
- Inviting only works for people who **already have an account** — no email
  invite for someone brand new.
- No per-agent workload view or auto-assignment/round-robin.
- **Suggested:** email invites and simple round-robin assignment.

**Design revamp (planned):**
- Team roster on `DataTable` with role chips; invite modal with an email-invite
  path (not just existing accounts).
- Per-agent workload cards (`hud-stat`) and a labels/assignment filter bar
  standardized across the inbox.

---

## 11. Automation — keyword auto-replies **[Live] [Planned]**

**What it does:** Rules that auto-reply to inbound messages by keyword (exact /
contains / catch-all), with a text or template response, priority ordering, and
an active toggle.

**Business example:** When anyone texts "hours", the bot instantly replies "We're
open 9am–8pm, Mon–Sat" — no human needed.

**Missing / improve for newbies:**
- Overlaps conceptually with Flows (below); a beginner won't know which to use.
- No analytics on how often each rule fires.
- **Suggested:** merge the mental model ("simple auto-reply" vs "multi-step bot")
  and show rule hit counts.

**Design revamp (planned):**
- Unified "Automation" hub landing that visually distinguishes **simple
  auto-reply** (this) from **multi-step bot** (Flows) with a "which do I use?"
  chooser card.
- Rule list on `DataTable` with a hit-count column (`hud-value` mono) per rule.

---

## 12. Chatbot flows (visual bot builder) **[Live] [Planned]**

**What it does:** Build a stateful chatbot triggered by a keyword. Nodes: send a
**message**, show **buttons**, **ask a question** (saves the answer to a
variable), **hand off to a human**, or **end**. A live validation panel catches
dead links, unreachable nodes, and loops; a **built-in simulator** lets you
test-chat the bot in the browser before going live. A sessions view shows every
contact who entered the flow and the answers they gave. Handoffs surface in the
inbox as "needs attention."

**Business example:** A clinic's "book" keyword starts a bot: "Which service?"
(buttons) → "Your name?" (question) → "Preferred date?" → hands off to reception
with the answers pre-filled.

**Missing / improve for newbies:**
- The builder is a form-based node list, not a drag-and-drop visual canvas —
  harder to picture the branching.
- No flow templates (lead capture, FAQ bot, appointment booking) to start from.
- No delay/wait or conditional-on-variable nodes yet.
- **Suggested:** a visual graph canvas and clonable starter bots.

**Design revamp (planned):**
- **Drag-and-drop visual graph canvas** replacing the form-based node list —
  nodes as cards, branches as edges, live validation panel docked beside it.
- `PresetGallery` of starter bots (lead capture, FAQ, appointment booking).
- Simulator restyled as a real WhatsApp thread (`chat-bubble-*`) for realistic
  test chats.

---

## 13. Opt-out compliance & number quality **[Live] [Planned]**

**What it does:** Contacts who text STOP are auto-unsubscribed (and re-subscribe
with START); the UI shows how/why each contact opted in or out. Re-opting-in a
STOP contact requires an explicit "I have consent" confirmation. Per-number
**Meta quality rating** (Healthy / At risk / Flagged) and daily messaging-tier
limit are shown; a flagged number triggers a warning banner before you send more
marketing.

**Business example:** Priya sees her number is "At risk" after a big blast and
holds off on the next one, avoiding a Meta block that would cut off all customer
messaging.

**Missing / improve for newbies:**
- Quality/tier concepts (GREEN/YELLOW/RED, TIER_1K) are Meta jargon — needs
  plain-language "what this means / what to do."
- No proactive guidance ("your quality dropped — send fewer marketing messages
  this week").
- **Suggested:** a health explainer and automatic pacing suggestions.

**Design revamp (planned):**
- Number-health card (`hud-panel` + `hud-glow` when flagged) translating
  GREEN/YELLOW/RED and TIER_1K into plain "what this means / what to do."
- Opt-in/opt-out history as a friendly timeline; re-opt-in consent gate kept but
  restyled as a clear confirm dialog.
- **Tier cap is now enforced backend-side** — the dispatcher throttles daily
  unique-recipient volume to each number's tier. Surface remaining daily budget
  ("820 of 1,000 sends left today") on the number-health card so a user
  understands why a big blast might not all go out at once.

---

## 14. Drip sequences (automated journeys) **[Live] [Planned]**

**What it does:** Timed, multi-step template journeys. Build an ordered list of
template steps, each with a delay (step 0 from enrollment, later steps from the
previous send) and personalized params (`{{name}}`, `{{waId}}`,
`{{attributes.key}}`). Contacts are enrolled **manually** (specific contacts or
all opted-in of a tag) or **auto-enrolled by tag** when the trigger tag is added.
Opt-in is re-checked at every send; opted-out/deleted contacts stop mid-journey.
Backend `DripsModule`; frontend under `app/dashboard/drips/` (builder, enroll
dialog, per-sequence enrollments view).

**Business example:** Priya builds a 3-step welcome journey — day 0 "thanks for
joining," day 2 "here's our bestseller," day 5 "10% off your first order" — and
tags new customers `welcome` to auto-enroll them.

**Missing / improve for newbies:**
- Tag-trigger only fires on contact create/update — **not** on CSV import or
  opt-in yet (backend deferred item).
- No quiet-hours / send-window control, no non-tag triggers (e.g. flow
  completion).
- Overlaps mentally with Campaigns (one-shot) and Flows (interactive) — newbies
  won't know which to pick.

**Design revamp (planned):**
- Journey builder as a vertical timeline of step cards (`hud-panel`), each
  showing delay + template preview (`chat-bubble-out`); reuse the campaign
  variable-personalization UI.
- `PresetGallery` of starter journeys (welcome series, re-engagement, post-purchase).
- Enrollments view on `DataTable` (contact, current step, next-step time,
  status chip); `StatStrip` for active/completed/stopped counts.
- A "Campaigns vs Drips vs Flows — which do I use?" chooser shared with §11/§12.

---

## Backend vs frontend — implementation gap

Comparison against the backend `LAUNCH.md` (source of truth: what's wired into
`AppModule`). Backend is **feature-complete for MVP** (all P0 + P1 shipped).
These are backend capabilities the frontend/doc hasn't fully caught up to:

| Backend capability | Backend | Frontend UI | In this doc | Action |
|---|---|---|---|---|
| Drip sequences (`DripsModule`) | ✅ Built | ✅ Built | ✅ Now added (§14) | Apply revamp |
| Quality/notification **alerts** (`AlertsModule`: `GET /alerts`, `POST /alerts/:id/ack`) | ✅ Built | ✅ **Now wired** | ✅ Done | Notifications page reads real alerts + ack (`ALERTS_ENDPOINTS`, `listAlerts`/`acknowledgeAlert`) with plain-language quality advice |
| **Conversational automation** (ice-breakers / commands: `GET/POST /whatsapp/conversational-automation`) | ✅ Built | ✅ Wired | ✅ (onboarding step-4) | Already configured during WhatsApp onboarding; consider also exposing it in Settings for later edits |
| **Contacts `attribute-keys`** (`GET /contacts/attribute-keys` — distinct custom-attribute keys) | ✅ Built | ⚠️ Bypassed | ⚠️ Gap | Segment/campaign/drip builders derive keys **client-side from a contact sample** (`segment-builder.tsx`) — misses keys absent from the sampled page. Add `CONTACTS_ENDPOINTS.ATTRIBUTE_KEYS` + use it for complete, cheap key lists |
| Inbound **media download proxy** (`GET /whatsapp/media/:mediaId/download`) | ✅ Built | Partial | Partial (§9) | Ensure inbox renders inbound media through the proxy (Meta URLs need the token) |
| Phone-number **quality/tier** (`GET /whatsapp/phone-numbers`) | ✅ Built | Partial | ✅ (§13) | Surface tier limits + plain-language health (see §13 revamp) |

**Backend gaps that constrain the frontend (don't build UI ahead of these):**
- **Binary media upload** endpoint not built (link/mediaId only) → the inbox
  drag-drop upload (§9 revamp) is blocked until `POST /{phoneNumberId}/media`
  lands.
- **Click/CTR tracking** not built → no "clicked" segment condition, no CTR in
  analytics (§8), no button-click funnel.
- **Messaging-tier cap** now enforced server-side — the campaign dispatcher
  gates each number to its tier's daily unique-recipient allowance and
  **auto-defers** a campaign (recipients stay `pending`) when the cap is hit.
  Frontend should surface this as a "paused: daily tier limit reached" reason on
  the campaign detail/recipient view, not a silent stall. (Follow-up still open:
  unknown-tier numbers are uncapped until the first quality webhook.)
- **Quality-drop alerts** done and wired (Notifications). Only **email/push
  delivery** of alerts is still deferred (currently DB row + WARN log).
- **Billing/wallet, CTWA ads, e-commerce, Zapier/public API, native WhatsApp
  Flows** — all P2, **not built** → keep those frontend screens as honest
  `[Placeholder]` "coming soon," not fake data.

**Net:** frontend doc was missing **Drips** (built both sides) and **Alerts**
(built backend → now wired). Conversational automation turned out to be already
wired in WhatsApp onboarding (step-4). The one remaining real gap is the unused
`contacts/attribute-keys` endpoint (frontend samples client-side instead).
Everything else in sections 1–13 has a real backend behind it.

---

## Placeholder / not-yet-real screens

These exist in the navigation but currently show **static or mock data**, not
live backend features:

- **API usage** **[Placeholder]** — usage charts are hard-coded.
- **Subscription / billing** **[Placeholder]** — plan data is mock; no real
  payment or usage-based billing.
- **Notifications** **[Live]** — now wired to the backend `AlertsModule`. Shows
  real number-health alerts (quality GREEN/YELLOW/RED/FLAGGED) with
  plain-language "what to do" advice, mark-as-read (single + all), and
  loading/empty/no-account states. Responsive.
- **Documentation & Support** **[Placeholder]** — static pages.
- **Users (super admin)** **[Placeholder]** — admin user management is mock.
- **Profile / Settings** **[Partly live]** — Team settings are real; profile,
  notification, security, and system tabs are mostly static toggles.

**Design revamp (planned, Phase 4 — as backends land):**
- All placeholder screens get the shared `PageHeader` + `EmptyState`
  ("coming soon" honest state) instead of fake data, so nothing looks live when
  it isn't.
- **Billing/subscription:** plan cards on `hud-panel`, usage meters (`hud-stat`
  mono), `CostBadge` reused for conversation spend.
- **Settings:** density toggle (comfortable/compact), theme, and the glossary
  live here; tabs restructured with the shared primitives.
- **Admin/Users:** `DataTable` with role/status chips once real management
  exists.

---

## Cross-cutting gaps that hurt newbies most

1. **No onboarding/guided first run.** The single biggest barrier — a beginner
   has no path from "empty account" to "first message sent."
2. **No cost visibility.** WhatsApp bills per conversation; nowhere does the tool
   estimate or show spend, which frightens/blindsides small businesses.
3. **Jargon everywhere.** WABA, phone number ID, quality rating, messaging tier,
   opt-in source — all shown raw. Needs plain-language tooltips throughout.
4. **No templates to start from.** Contacts, segments, campaigns, and flows all
   start from a blank slate. Clonable presets would dramatically lower the entry
   bar.
5. **File upload gap in the inbox.** Sending media by URL is unintuitive; drag-drop
   is table-stakes for non-technical users.
6. **No mobile app / responsive polish** for agents replying on the go.
7. **Overlap between Automation and Flows** confuses newcomers — needs a clear
   "which one do I use?" explainer or a merged entry point.

## Suggested "newbie mode" roadmap (highest impact first)

1. Guided setup checklist on first login.
2. Plain-language tooltips + a glossary for every Meta term.
3. Starter libraries: templates, segments, and flow bots you clone in one click.
4. Estimated cost preview before any broadcast.
5. Drag-drop file upload in the inbox.
6. A single contact profile/timeline view.
7. Benchmarks and interpretation on the analytics dashboard.

---

## Future feature roadmap (not built — mirrors backend P2 backlog)

Forward-looking so this doc is the single frontend source of truth. These are
**not built** on either side yet (from backend `LAUNCH.md` P2); listed so we
scope the frontend as each lands:

- **Click-to-WhatsApp ads + retargeting** (AiSensy's edge).
- **E-commerce** — Shopify/WooCommerce, catalog messages, cart/order
  notifications, payment links.
- **Integrations** — Zapier, a public REST API for customers, Google Sheets.
- **Native WhatsApp Flows** (in-chat forms).
- **Billing / wallet** — usage metering + markup over Meta's per-conversation
  pricing (this also makes the Subscription placeholder real).

Near-term (backend deferred backlog, unlock frontend work when shipped): binary
media upload → inbox drag-drop; click/CTR tracking → "clicked" segment + CTR
analytics; pending-invite team flow → email invites.

---

## Adding a new feature — keep this scalable

The app scales by **convention, not by cleverness**. Every feature follows the
same path, so feature #15 costs the same as feature #5. When you add one:

1. **Route** — a segment under `app/dashboard/<feature>/` (App Router). Sub-flows
   as nested segments (`[id]/`, `new/`, `[id]/edit/`); multi-step wizards as a
   route group + shared `Stepper`.
2. **API config** — add the endpoint group to `config/api-config.ts` (mirror the
   backend route exactly; verify it exists in the backend first).
3. **Service + types** — add typed functions to `services/api.ts`
   (`Promise<RealType>`, **not** `any` — see Part 2, Phase 1)
   and, once Phase A lands, a typed TanStack Query hook.
4. **UI from shared primitives** — build with `PageHeader`, `StatStrip`,
   `DataTable`, `EmptyState` (and `JargonTooltip`/`PresetGallery`/`CostBadge` as
   they're built). Don't hand-roll a header/table/empty state — compose the
   primitives so the app stays visually one system.
5. **States** — handle loading (skeleton), empty (`EmptyState`), and error
   (toast + boundary) every time. Responsive by default (mobile→desktop).
6. **Document it here** — add a section using the template below, and update the
   backend-vs-frontend gap table if a backend contract is involved.

### Feature-entry template (copy for each new feature)

```markdown
## N. <Feature name> **[Live|Placeholder|Gap] [Revamped|Planned]**

**What it does:** <plain-English, one paragraph.>

**Business example:** <a real small-business scenario.>

**Missing / improve for newbies:** <gaps + a "Suggested:" line.>

**Design revamp (planned/implemented):** <which shared primitives; responsive note.>

**Backend:** <module/endpoints it depends on; note any contract in the gap table.>
```

**Scalability foundation** (why adding features stays cheap): the shared
primitives (`components/*`, built), the typed API layer (Phase 1), and the
TanStack Query data layer (Phase A) are the three things that let new features
reuse instead of reinvent. Keeping to this convention is what keeps the codebase
world-class as it grows — see Part 2 (Infrastructure & Hardening Plan).


---

# Part 2 — Frontend Infrastructure & Hardening Plan


Goal: take the frontend from "prototype-grade infra on a solid product" to
production-credible, **without breaking any existing functionality**. Every
phase is independently shippable, ordered lowest-risk first, and either purely
additive or gated behind a report-only mode before it can fail a build.

> Guiding rule: **no phase changes user-visible behavior on the happy path.**
> We add safety nets first (visibility), fix underneath with the net in place,
> then flip the gates last.

**Scalability is a first-class goal here.** Three items in this plan are the
foundation that keeps *adding features* cheap as the product grows: the typed API
layer (Phase 1), the TanStack Query data layer (Phase A.1), and the shared UI
primitives (already built — `PageHeader`, `DataTable`, `StatStrip`,
`EmptyState`). Combined with the "Adding a new feature" convention in Part 1,
feature #15 costs the same as feature #5 — reuse, not reinvention.

## Backend coordination (established facts)

Verified against `backend-wb` so the frontend plan matches reality:

- **Auth today (updated — Phase 4 shipped):** `POST /auth/login` sets the JWT as
  an `httpOnly; SameSite=Lax` cookie and returns **`{ user }` only** (no
  `access_token` in the body). `POST /auth/signup` returns `{ id, email, name }`
  and issues no token (the user logs in separately). The JWT strategy reads the
  cookie (Bearer fallback retained). CORS is `credentials: true` with an explicit
  origin allowlist. **The frontend no longer holds a JS-readable token.** History:
  the token used to be `{ access_token, user }` in the body, stored via js-cookie
  and sent as a `Bearer` header — that is the pre-Phase-4 state.
- **Response shape:** there is **no global response interceptor/wrapper** on the
  backend. Every controller returns the raw service result (an object or array),
  never `{ data: ... }`. The frontend's pervasive `res?.items ? res : res?.data`
  fallback is therefore dead defensive code — safe to drop as we type each call.
- **Endpoint contracts:** the REST routes are stable and already match
  `config/api-config.ts` 1:1 (verified route-by-route). Typing work is about
  response *shapes*, not new endpoints.
- **Error contract (verified):** the backend uses **NestJS default exception
  handling** — no custom filter. Error bodies are
  `{ statusCode: number, message: string | string[], error: string }`
  (e.g. `{ statusCode: 400, message: "email is required", error: "Bad Request" }`).
  `message` is usually a string but is an **array** for validation errors — the
  frontend must join arrays, not render `[object Object]`.
- **401 is reliable:** every JWT-guarded route returns `{ statusCode: 401 }` via
  Passport `AuthGuard('jwt')`. A central 401 handler can safely key on
  `status === 401`.
- **Non-JSON responses exist:** `GET /whatsapp/media/:mediaId/download` returns
  raw bytes (`res.send`), and 5xx/proxy errors return HTML — so a blanket
  `response.json()` will throw. The fetch wrapper must guard on
  `content-type`/status.
- **Rate limiter (updated — this is now FALSE as originally written):** the
  backend registers `ThrottlerGuard` as a global `APP_GUARD` — **120 req / 60s on
  every route, 5 req / 60s on `login` + `signup`** (`@Throttle` per-handler;
  webhooks `@SkipThrottle`). So the frontend **can** get `429`s, especially on
  repeated login attempts. Phase E should add a 429 case (surface "too many
  attempts, try again shortly"), and login UX must expect a 5/min cap. Meta's own
  rate limits still surface only as error *message* text.

**Open coordination items:**
1. ~~**httpOnly auth (Phase 4)**~~ — **DONE.** Backend sets the JWT as an
   `httpOnly; SameSite=Lax` cookie named `access_token` (`maxAge` = 1 day, the
   token's own life); cutover complete — the body no longer returns
   `access_token`. See Phase 4.
2. **Typed contracts (Phase 2/1):** the backend source (`backend-wb`) is on the
   same machine, so shapes are being verified controller-by-controller as each
   API family is typed — not from observed responses. (Auth + Contacts done so
   far.) A shared generated type source remains the world-class version.
3. ~~**JWT cookie extractor (Phase 4 / E)**~~ — **DONE.** Strategy now uses
   `ExtractJwt.fromExtractors([cookieExtractor, fromAuthHeaderAsBearerToken()])`.

---

## Phase 0 — Safety nets (purely additive, zero behavior change) — **DONE**

Ship these first so everything after is observable and recoverable.

1. ✅ **DONE** — **Error boundaries** — added `app/error.tsx`,
   `app/global-error.tsx`, and `app/not-found.tsx`. A runtime throw now shows a
   recovery UI ("something went wrong · retry") instead of a white screen.
   (Sentry reporting inside them is stubbed — see #2.)
2. ✅ **DONE (stubbed)** — **Error tracking** — single reporting seam
   `lib/observability.ts` gated on `NEXT_PUBLIC_SENTRY_DSN` (no-op console until a
   DSN is set; Sentry-ready — one function to swap in `captureException`). Wired
   into `error.tsx`/`global-error.tsx` + a global `unhandledrejection`/`error`
   handler. web-vitals reporting funnels through the same seam.
3. ✅ **DONE (report-only)** — **CI** — added `.github/workflows/ci.yml` running
   `typecheck` (`tsc --noEmit`), `lint`, and `build` on PRs/push to main, **not
   blocking merges** (`continue-on-error: true` on every step). Makes the hidden
   error count *visible*. Promotion to blocking = Phase 2 #3.
4. ✅ **DONE** — **Consolidate lockfiles** — **yarn** is canonical (`yarn.lock`);
   the empty `pnpm-lock.yaml` stub was deleted and CLAUDE.md documents it.

**Verification:** app still runs identically; CI posts a typecheck/lint error
count on PRs; a forced throw shows the boundary, not a white screen. (Sentry
capture pending #2.)

## Phase 1 — Type the API layer (incremental, function-by-function)

`services/api.ts` has ~80 `Promise<any>` returns; call sites cope with
`res?.items ? res : res?.data`. Backend returns raw shapes, so:

1. For each API function, define an interface for its real response and change
   `Promise<any>` → `Promise<TheType>`. Do it **one function at a time** —
   independently reviewable, nothing else changes.
2. As each is typed, drop the now-provably-dead `?.data` fallback at its call
   sites (backend never wraps). Keep the `?.items` shape where it's real.
3. Track progress against the CI typecheck count from Phase 0 — it should fall
   monotonically.

**No-break safeguard:** typing is compile-time only; runtime behavior is
identical. If a response shape surprises us, that's a *real* latent bug the
`any` was hiding — fix it then, with the error boundary + Sentry already live.

**Verification:** `tsc --noEmit` error count drops to 0; app behaves identically
(smoke-test the main flows after each batch).

## Phase 2 — Flip the type gate — **DONE**

Only after Phase 1 gets `tsc --noEmit` to **clean**:

1. ✅ **DONE** — Set `typescript.ignoreBuildErrors: false` in `next.config.mjs`.
   `tsc --noEmit` is clean (fixed the last error by adding `@types/js-cookie`);
   a type error now fails the build. Added a `typecheck` script (`tsc --noEmit`).
2. ✅ **DONE** — `eslint.ignoreDuringBuilds: false`. `next lint` is error-clean
   (cosmetic `react/no-unescaped-entities` disabled; `no-unused-vars` /
   `exhaustive-deps` kept as non-blocking warnings). A lint error now fails the
   build.
3. ✅ **DONE** — CI promoted to **blocking**: `continue-on-error` removed from
   `.github/workflows/ci.yml`; typecheck/lint/unit-tests/build all gate merges.

**No-break safeguard:** the gate is flipped *after* the tree is already clean, so
the first blocking build is green. If anything slipped, revert the one-line flag.

**Verification:** `yarn build` passes with both gates ON; a deliberately-broken
type or lint PR now fails CI and the build.

## Phase 3 — Resilience & UX consistency (additive)

1. Per-route `loading.tsx` (only 4 exist for ~20+ routes) using the shared
   skeleton/`DataTable` loading conventions.
2. Standardize the fetch/error/empty pattern on the shared primitives
   (`EmptyState`, toast conventions) so every page degrades the same way.
3. Wire the last hardcoded placeholders (e.g. the sidebar notification badge
   count) to real data or hide them.

**Verification:** navigation shows skeletons, not blank flashes; no page throws
on empty/error states.

## Phase 4 — Auth hardening (coordinated with backend) — **DONE**

**Shipped: the JWT is now an httpOnly cookie, unreadable by JavaScript.** Done
as a full cutover across both repos (`frontend-DA` + `backend-wb`), verified at
runtime. This closes Phase S #1, the single biggest security risk.

What was implemented (both repos, one coordinated change since `backend-wb` is
on the same machine):

- **Backend (`backend-wb`):**
  - Added `cookie-parser`; wired in `main.ts`.
  - `POST /auth/login` sets the JWT as an
    `httpOnly; SameSite=Lax; Secure(prod-only)` cookie named `access_token`
    (`src/auth/auth-cookie.ts` centralizes name + options; `maxAge` mirrors the
    token's `expiresIn: '1d'`). The login body now returns **`{ user }` only —
    `access_token` is no longer in the response body.**
  - JWT strategy reads the cookie first, Bearer header as fallback
    (`ExtractJwt.fromExtractors([cookieExtractor, fromAuthHeaderAsBearerToken()])`).
  - **Realtime WebSocket** (`realtime.server.ts`) authenticates from the
    handshake `Cookie` header (`access_token`), not a URL query token; the old
    `?token=` path stays as a fallback. Keeping the JWT out of the URL also stops
    it leaking to logs/history.
  - New `POST /auth/logout` clears the cookie (the client can't — it's httpOnly).
- **Frontend:**
  - `apiRequest` sends `credentials: "include"`; the Bearer header is gone.
  - Stopped writing the JS-readable `authToken` cookie entirely. Only the
    non-sensitive `userData` cookie remains, used as the UI session marker.
  - `isAuthenticated()` gates on the `userData` marker (JS cannot see the real
    token by design). A stale marker still yields a clean 401 → login redirect.
  - `CHAT_WS_URL(accountId)` no longer carries a token; the socket relies on the
    httpOnly cookie riding the same-site handshake.
  - Media-blob fetch uses `credentials: "include"`. `getAuthTokenFromCookie` was
    deleted (zero callers remain).

**Verified at runtime** against a fresh isolated backend build (alt ports,
`NODE_ENV=test` so cron dispatchers stayed off): HTTP cookie-only auth → 500
(guard accepted, user just not in DB); WS cookie handshake → 403 (JWT verified
from cookie, ownership check ran); bad-secret / no-auth → 401 on both. Both
repos `tsc` clean, frontend lint/build green.

**Still open (follow-ups, not blockers):**
- **Browser end-to-end test** — log in, confirm the `access_token` cookie shows
  **HttpOnly** in DevTools, navigate → refresh → confirm calls + chat socket
  work. Forged-token curl proves the mechanism; only a browser proves the full
  login→cookie→resend loop.
- **`access_token` removed from the login body** — any *other* consumer (mobile,
  Postman, tests) that read it will break. This frontend only reads `user`.
- The Bearer-header extractor remains on the backend as a harmless fallback; it
  can be removed once nothing else uses it.
- The `userData` cookie still has a 7-day expiry vs. the token's 1 day, so the
  UI marker can outlive the session — the 401 handler covers the gap.

## Phase S — Security hardening

Ranked by severity from a direct scan. Phase 4 (httpOnly auth) is the anchor;
the rest layer defense-in-depth. All steps are additive or dual-safe — none
change happy-path behavior.

**HIGH**
1. **httpOnly + Secure + SameSite auth cookie — DONE (Phase 4).** The JWT is now
   an `httpOnly; SameSite=Lax; Secure(prod)` cookie set by the backend and
   unreadable by JavaScript; the frontend no longer stores a token client-side,
   and the realtime WebSocket authenticates from the same cookie instead of a
   URL token. This was the single biggest risk (a JS-readable token turns any
   XSS into account takeover) — now closed. See Phase 4 for detail + follow-ups.

**MEDIUM**
2. **Content-Security-Policy + security headers** — `next.config.mjs` sets no
   `headers()`. Add a `headers()` block (or `middleware.ts`) with
   `Content-Security-Policy`, `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   and HSTS. **No-break rollout:** ship CSP in **`Content-Security-Policy-Report-Only`**
   first, watch violation reports, tighten, then enforce. CSP is the strongest
   XSS mitigation and pairs with #1.
3. **Route middleware (`middleware.ts`)** — protected routes are guarded
   **client-side only** today (`typeof window` in `lib/auth.ts`); pages flash
   before redirect and there's no edge enforcement. Add `middleware.ts` to
   redirect unauthenticated requests at the edge. Backend JWT stays the real
   gate — this is defense-in-depth, so it can't break authorized flows.

**LOW**
4. **Remove mock secrets from client source — DONE.** The whole
   `app/dashboard/waba/` placeholder route (list + `[wabaId]` detail + loading)
   was deleted: it shipped a fake FB-token-shaped `apiKey` and webhook URLs in
   the bundle, nothing linked to it, and the live surface is
   `/dashboard/whatsapp`. Verified: no `EAABZ`-shaped strings in `.next/`.
5. **`rel="noopener noreferrer"` on every `target="_blank"`** (2–3 spots) —
   closes reverse-tabnabbing. Trivial, additive.
6. **Dependency audit in CI — DONE.** A `yarn audit --groups dependencies` step
   runs in CI between the unit tests and the build. `yarn audit` exits with a
   **severity bitmask** (1 info, 2 low, 4 moderate, 8 high, 16 critical) and
   `--level` only filters the printed report, not the exit code — so the step
   masks for `high|critical` (`code & 24`) and fails only on those; moderate and
   below stay advisory in the log.

   The first run surfaced real vulnerabilities (status had been **unknown**),
   all now fixed:

   | Package | Was | Now | Severity |
   |---------|-----|-----|----------|
   | `next` | 15.2.4 | 15.5.23 | **critical** — RCE in React flight protocol (+ high DoS via Server Components) |
   | `js-cookie` | 3.0.5 | ^3.0.8 | high — per-instance prototype hijack in `assign()` |
   | `postcss` (via `next`) | 8.5.3 | ^8.5.26 | high — file read via attacker-controlled `sourceMappingURL` |
   | `sharp` (via `next`) | 0.33.5 | ^0.35.3 | high — inherited libvips CVEs |
   | `lodash` (via `recharts`) | 4.17.21 | ^4.18.1 | high — code injection via `_.template` |
   | `nanoid` (via `postcss`) | 3.3.11 | ^3.3.18 | high — infinite loop on negative size |

   The four transitive ones are pinned with a yarn 1 **`resolutions`** block in
   `package.json` (their parents still declare the vulnerable ranges). Audit is
   now clean at every severity: `{info:0, low:0, moderate:0, high:0, critical:0}`.
   `sharp` crossed a 0.x minor (0.33 → 0.35) — it's an optional `next` dep used
   only for self-hosted image optimization, so re-check `next/image` if image
   optimization is ever self-hosted in prod.

**Verification:** token not readable from `document.cookie`/JS after Phase 4;
CSP report-only shows no legitimate violations before enforcing; unauthenticated
edge requests redirect via middleware; `audit` runs green (or triaged) in CI;
no token-shaped strings in the client bundle.

## Phase E — Error handling (mostly one file: `apiRequest`)

The per-call error path is already decent (typed `ApiError`, Meta-message
extraction, 88 `toast.error` across 126 catches). The **systemic** pieces are
missing. All fixes below are backend-contract-aligned (see coordination facts).

**HIGH**
1. **Central 401 → session recovery.** Today only `facebook-code-handler` reacts
   to 401; an expired token elsewhere just throws a generic toast, stranding the
   user. Backend 401 is reliable (`status === 401`), so: in `apiRequest`, on a
   401, clear the auth cookie once and redirect to `/login?expired=1` (guard
   against redirect loops on the auth pages themselves). Centralizes what
   CLAUDE.md already *claims* happens.

**MEDIUM**
2. **Guard `response.json()`.** The wrapper calls `.json()` unconditionally;
   backend has a byte endpoint (`media/.../download`) and returns HTML on 5xx —
   both throw and get masked as a bogus `"Network error" 500`. Parse only when
   `content-type` is JSON and status isn't `204`; otherwise surface the real
   status + `response.statusText`.
3. **Handle array `message`.** Backend validation errors come as
   `message: string[]`. `apiRequest` must join arrays
   (`Array.isArray(m) ? m.join(", ") : m`) before building the `ApiError`, or the
   user sees `[object Object]`.
4. **Request timeout via `AbortController`.** No timeout today — a hung request
   hangs forever (stuck spinners, unmount warnings). Add a default ~20s abort in
   `apiRequest`, surfaced as a clear "request timed out" `ApiError`.

**LOW**
5. **Breadcrumb swallowed catches.** ~38 catches are silent (`.catch(() => {})`,
   mostly secondary fetches). Keep them non-blocking but log to Sentry (Phase 0)
   so silent failures stop being invisible.
6. **Error boundaries** — `app/error.tsx` / `global-error.tsx` / `not-found.tsx`.
   (Same item as Phase 0 — listed here for completeness of the error story.)
7. **Global `unhandledrejection` handler** → Sentry, once it's wired.

**No-break safeguard:** items 1–4 are localized to `apiRequest`; behavior only
*changes* on paths that currently fail badly (401, non-JSON, hung). Ship behind
the Phase 0 error boundary + Sentry so any surprise is caught and visible.

**Verification:** expired token anywhere → single clean redirect to login; a 502
HTML response shows a real status, not "Network error"; a validation error shows
the joined message; a stalled request aborts with a timeout toast; swallowed
failures appear as Sentry breadcrumbs.

## Phase A — Architecture & world-class tier

Phases 0–E get us to *production-credible*. These four separate that from
*genuinely world-class*. Ordered by leverage.

1. **Data-fetching layer (TanStack Query).** Today every page hand-rolls
   `useState + fetch` — the root cause of the `res?.data` guessing, manual
   race-condition guards (e.g. `previewSeq` in the segment builder), duplicated
   loading/error state, no caching, and refetch storms. Introduce TanStack Query
   with typed query/mutation hooks wrapping the (now-typed, Phase 1) API
   functions. It gives request dedup, caching, stale-while-revalidate, retries,
   and cancellation **for free and systematically** — absorbing parts of Phase E
   (retries) and Phase 3 (loading/error).
   - **Sequencing:** after Phase 1 (typed API) so hooks are typed; migrate
     **page-by-page**, old fetch and new hooks coexist — no big-bang, no break.
   - **No-break safeguard:** each page migrated + smoke-tested independently;
     the manual path keeps working until a page is converted.
2. **Accessibility.** Add `eslint-plugin-jsx-a11y` (report-only first), then
   audit the shared primitives (`DataTable`, `PageHeader`, dialogs) and critical
   flows for keyboard nav, focus management, ARIA labels, and color contrast in
   both themes. Wire it into CI.
3. **Env var validation.** Validate `process.env` at boot with `zod` (already a
   dependency) — a missing `NEXT_PUBLIC_API_BASE_URL` should fail the **build**,
   not silently fall back to `localhost` in prod. A ~20-line `env.ts` the app
   imports first.
4. **Performance budget + RUM.** Add `web-vitals` reporting (→ Sentry/analytics),
   run bundle analysis, and code-split the heavy routes (flow builder, chart
   pages) with `next/dynamic`. Set a bundle-size budget in CI so regressions are
   caught. Measure Core Web Vitals rather than hope.

**Already adequate (explicitly not adding):** the realtime WS client is resilient
(reconnect + backoff in `use-chat-socket.ts`); forms use `react-hook-form + zod`.

**Verification:** pages on TanStack Query show cached-instant navigation + no
duplicate in-flight requests; a11y lint + audit pass; build fails on a missing
required env var; Web Vitals reported and within budget in CI.

## Phase 5 — Automated tests

1. **Vitest** for pure `lib/` logic first (highest value, zero flakiness):
   `segment-rules`, `whatsapp-template`, `flow-validation`.
2. **Playwright** smoke tests for the critical flows: login, send a chat message,
   create a campaign, import contacts. Run in CI (Phase 0 pipeline).
3. Component tests for the shared primitives (`DataTable`, `PageHeader`).

**Verification:** CI runs the suite on every PR; the smoke tests catch a broken
critical flow before merge.

---

## Sequencing & risk summary

| Phase | Risk | Breaks functionality? | Backend needed? |
|-------|------|-----------------------|-----------------|
| 0 Safety nets | Very low | **DONE** — boundaries + CI + lockfile + Sentry seam (stubbed to `NEXT_PUBLIC_SENTRY_DSN`) | No |
| 1 Type API layer | Low | **DONE** — 0 `no-explicit-any`; `tsc --noEmit` clean across services/api + all call sites | Shapes verified vs `backend-wb` |
| 2 Flip gates | Low | **DONE** — type + lint gates ON; CI blocking (continue-on-error removed); `yarn build` green | No |
| 3 Resilience/UX | Low | **DONE** — PageSkeleton loading.tsx across 24 routes | No |
| 4 Auth → httpOnly | Medium | **DONE** (full cutover, both repos) | Done — both repos changed |
| S Security hardening | Low–Medium | **DONE** — #1 (httpOnly), CSP report-only+headers, middleware, noopener, #4 mock-secret page removed, #6 audit in CI (0 high/critical after upgrades) | Partly (#1 via Phase 4) |
| E Error handling | Low | **DONE** — central 401, non-JSON/204 guard, array-message join, 20s timeout | Contract verified |
| A Architecture/world-class | Low–Medium | **DONE** — TanStack layer + hooks (segments migrated, rest page-by-page), a11y (next config), env validation, web-vitals | No |
| 5 Tests | Very low | **DONE** — Vitest 15 tests (lib/) green in CI; Playwright smoke suite (needs running app) | No |

**Definition of done (world-class frontend infra):** type + lint gates ON and
green in blocking CI; API layer fully typed; error boundaries + Sentry live;
httpOnly auth + enforced CSP/security headers + edge route middleware; dep-audit
in CI; central 401 recovery + robust fetch error handling + error boundaries +
Sentry; smoke + unit tests in CI; single lockfile; consistent loading/empty/error
states; typed data-fetching layer (TanStack Query); a11y-linted + audited;
validated env; Web Vitals within a CI budget.

**Recommended first PR:** Phase 0 in full — it's all additive, unlocks
visibility for everything else, and can't break anything.
