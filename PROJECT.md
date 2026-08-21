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
> Design status: **[Revamped]** = meets the Signal definition of done below ·
> **[Planned]** = design revamp scoped below, not yet met. As of the Signal
> rewrite no section is **[Revamped]** — auth (§1), flows (§12), and billing
> (§15) were revamped against the older, flatter bar and were re-tagged
> **[Planned]**; they are partly there and are the cheapest sections to finish.

---

## Design Revamp Plan — whole application

A **product-wide visual + UX revamp**. Goal: turn a functional-but-dense
internal tool into a polished, confidence-inspiring product a non-technical
small-business owner can navigate without training. The auth flow (§1) carries
the most of the new language today — `AuthShell`, the HUD surfaces, the token
set — and is the closest thing to a reference implementation, but it predates
the Signal direction below and is not yet the bar. Every section below carries
a **Design revamp** note describing how the new system applies to that surface.

### Design direction — "Signal"

The revamp targets a **calm-futuristic** product: depth, light, and motion
instead of flat cards; every screen readable by a shop owner who has never seen
a dashboard. Four rules hold it together:

1. **Futuristic, never sci-fi.** Depth and glow carry meaning (elevation, live
   state, focus) — never decoration on top of dense data.
2. **WhatsApp is the anchor.** Green stays the single action/success color, and
   WhatsApp's own visual vocabulary — chat bubbles, delivery ticks, the doodle
   wallpaper — is reused as UI metaphor so the tool feels like an extension of
   the app the user already trusts.
3. **Friendly beats clever.** Plain language, one primary action per screen,
   preview before commit, undo instead of confirm.
4. **Every viewport, every time.** A layout that only works at 1280px is not
   done. Mobile-first is how each screen is built, not a pass that happens
   after — see the responsive section below.

### Token architecture

**The rule: no component names a colour, radius, shadow, or duration.**
Everything resolves through custom properties defined in `app/globals.css` and
exposed to Tailwind in `tailwind.config.ts`. That is what makes seven themes
possible without seven sets of components — and a `text-red-600` anywhere is a
bug, not a shortcut.

Token groups, all per theme and per mode:

- **Structure** — `--background`, `--surface`, `--surface-2`, `--card`,
  `--popover`, `--highlight`, `--shadow-color`, `--shadow-strength`.
- **Text** — `--foreground`, `--foreground-secondary`, `--muted-foreground`,
  `--muted`. Three weights of voice, not one.
- **Borders** — `--border-subtle`, `--border`, `--border-strong`, `--input`.
- **Brand** — `--primary` with `-soft` / `-emphasis` / `-foreground` tonal
  levels, plus `--secondary(-vivid)`, `--accent(-vivid)`, `--ring`.
- **Status** — `--success`, `--warning`, `--destructive`, `--info`, each with a
  `-soft` ground and a `-foreground`.
- **Navigation** — the full `--sidebar-*` set.
- **Data visualisation** — `--chart-1 … --chart-6`, harmonised per theme.
  Charts never use library defaults.
- **WhatsApp** — `--whatsapp`, `--facebook`, and the delivery-tick language
  (`--tick-queued|delivered|read|failed`), which derives from the status tokens
  so the ticks always match the active palette.
- **Non-colour** — type scale (`--text-*`, `--tracking-*`, `--leading-*`),
  spacing rhythm (`--space-1…8`), radius (`--radius-xs…xl`, `--radius-float`,
  `--radius-bubble`), motion (`--ease-out-soft`, `--ease-spring`,
  `--duration-fast|base|slow`), and elevation (`--shadow-xs…xl`,
  `--glow-primary`, `--glow-focus`).

Shadows derive from `--shadow-color` and `--shadow-strength` rather than being
written per theme, so dark palettes get real depth instead of black smeared over
a tinted surface.

### Theme system

Two independent axes, composed:

- **Palette family** — `data-theme` on `<html>`, owned by the palette provider
  in `components/theme-provider.tsx`, persisted in `localStorage`, and applied
  before first paint by an inline bootstrap script (a one-frame flash of the
  wrong theme is exactly the cheap-template feel this design avoids).
- **Light / dark** — the `.dark` class, owned by `next-themes`, with a System
  option.

CSS cascade order is load-bearing: `:root` (default light) → `[data-theme=…]`
light blocks → `.dark` (default dark) → `.dark[data-theme=…]` blocks, which win
on specificity.

Seven families ship, each designed in both modes — dark is authored, never an
inversion, and light avoids flat pure white:

| Theme | Character |
|---|---|
| **Calm Blue** (default) | Soft blue, misty cool white, subtle navy |
| **Sage** | Muted emerald on warm ivory |
| **Lavender** | Soft violet on cool neutrals |
| **Ocean** | Deep teal and soft cyan |
| **Warm Sand** | Cream and beige with terracotta |
| **Midnight** | Charcoal/navy lit by soft teal; dark-first |
| **High Contrast** | Accessibility first — strong ratios, hard focus, ambience off |

`components/theme-selector.tsx` is the control: each option renders a miniature
of the interface in that palette (rail, panel, primary action, accent, hairline)
rather than a text label, because seven names are indistinguishable and seven
swatches are not. Switching is instant, with a colour-only crossfade.

The palette registry lives in `lib/themes.ts`. Its swatch values are duplicated
from `globals.css` on purpose — a preview must paint a theme that is *not*
currently applied, so it cannot read the live custom properties. Retune a
palette and update both.

### Design language

- **Brand:** WhatsApp green (`--primary` / `--whatsapp`) as the action/success
  color, Facebook blue (`--facebook` / sidebar tokens) as the structural/nav
  accent. `brand-gradient` (green→blue) for hero and empty-state moments only —
  never behind dense data.
- **WhatsApp motifs (the "touch"):**
  - **Delivery ticks as a universal status language** — one grey tick = queued,
    two grey = delivered, two green = read/succeeded, red = failed. Same
    iconography in campaigns, inbox, flows, and drips, so status is learned once.
  - **Bubble geometry** — asymmetric radius (`--radius-bubble`, tail corner
    squared) on message previews, quick-reply chips, and assistant hints.
  - **Doodle wallpaper** — the familiar WhatsApp chat pattern as a 3–4% opacity
    SVG texture behind inbox panes and empty states only.
  - **Green as scarcity** — exactly one green primary action per view; everything
    else neutral. Green must always mean "this sends/saves/succeeds".
- **Surface tiers (replaces flat cards).** Three elevation levels, tokenized:
  - `surface-base` — page ground, doodle/aurora texture allowed.
  - `surface-raised` — HUD panel system already in `globals.css` (`hud-panel`,
    `hud-strip`, `hud-stat`, `hud-label`, `hud-value`, `hud-row`, `hud-glow`);
    subtle blur, hairline border, soft shadow. Default for stats and data cards.
  - `surface-float` — dialogs, command palette, popovers: stronger blur, larger
    radius, ring-lit border.

  Elevation is expressed by blur + border luminance + shadow spread, never by
  heavier fill — dark mode stays legible.
- **Ambient light:** a low-opacity green→blue aurora mesh behind hero zones,
  auth, empty states, and the first-run checklist. Capped at 8% opacity, and
  static (no animated gradient) behind anything holding numbers or text input.
- **Glow = state, not style:** `hud-glow` reserved for live/active/selected.
  A pulsing green halo means "happening right now" (sending, agent typing, flow
  executing) and appears nowhere else.
- **Type:** `responsive-heading` / `responsive-subheading` scale, mono
  (`font-mono tabular-nums`) for every number, count, and metric. Metrics get
  optical alignment — value large, unit and delta small and muted beside it.
- **Radius scale:** `--radius-sm` controls/inputs, `--radius` cards,
  `--radius-lg` floating surfaces, `--radius-bubble` chat elements. Bigger and
  softer than today's uniform `0.5rem`.
- **Density:** two modes — comfortable (default, newbie-friendly) and compact
  (power users, toggled in settings). Tables use `responsive-table` with
  `hide-on-lg` / `hide-on-md` / `hide-on-sm` column priorities.
- **Dark mode:** first-class and the design's *primary* canvas — the HUD/glow
  language is authored dark-first, then verified in light. Every component uses
  the token set; no hard-coded colors.

### Motion system

Motion is how the product reads as modern. Standardized, not ad-hoc:

- **Easings/durations:** `--ease-out-soft` (120–180ms) for hover/focus/color;
  `--ease-spring` (220–320ms, slight overshoot) for anything that enters, opens,
  or changes size. Nothing exceeds 350ms.
- **Entrance:** lists and stat strips stagger in at 30ms intervals, max 8 items,
  then instant — never a slow cascade down a 500-row table.
- **Shared-element transitions** between list row and detail (contact, campaign,
  conversation) using the View Transitions API, with a plain fade fallback.
- **Number roll-up:** `AnimatedNumber` counts metrics up on first paint and on
  live update; deltas flash green/red once, then settle.
- **Live pulse:** slow 2s pulse on `LiveDot` for real-time surfaces (inbox,
  campaign send progress, flow runs).
- **Optimistic + undo:** the row updates instantly, a toast holds a 5s undo.
- **`prefers-reduced-motion`:** every rule above degrades to opacity-only or to
  no animation. Non-negotiable.

### Responsive & device-agnostic — non-negotiable

Every screen must work and look right on **mobile, tablet, desktop, and any
viewport in between** — no horizontal scroll, no cut-off controls, no
desktop-only layouts, no "we'll do mobile later". Responsive is part of the
definition of done, not a follow-up ticket. Agents run the inbox from a phone
and owners check numbers on a phone, so mobile is a first-class surface, not a
degraded one.

**Build on what exists.** Mobile-first, using the existing utilities
(`responsive-container`, `responsive-heading`, `responsive-subheading`,
`responsive-flex`, `card-grid`, `p/px/py-responsive`, `btn-responsive`,
`responsive-table`) plus Tailwind `sm/md/lg/xl`. Prefer fluid sizing
(`clamp()`, `min()`, `%`, `fr`) over breakpoint-stacked fixed values, and
container queries for components that appear at several widths (`MetricCard`
in a 4-up strip vs. a sidebar rail).

**Adaptive layouts:**

- Sidebar collapses to a drawer plus bottom-nav on mobile.
- Multi-pane screens (inbox, flow canvas, contact detail) stack to one pane at
  a time with real back navigation — never a squeezed three-column layout.
- Tables become card lists, or shed columns by priority via
  `hide-on-lg` / `hide-on-md` / `hide-on-sm`. `DataTable` owns this so every
  list inherits it.
- Wizards (`Stepper`) go vertical, one step at a time, on narrow screens.
- Dialogs become bottom sheets under `md`; filter panels become sheets too.
- Long forms keep their primary action in a sticky bottom bar within thumb
  reach, respecting safe-area insets.

**The futuristic layer must degrade cleanly** — this is where a glassy design
usually breaks on phones:

- `CommandPalette` — full-screen sheet on mobile with the on-screen keyboard
  accounted for (`dvh`, not `vh`); still reachable from a visible search
  affordance, since there is no ⌘K on a phone.
- `PhonePreview` — the device frame is desktop/tablet only; on mobile it drops
  the chrome and renders the bubbles inline, or moves behind a "Preview" tab.
- `ActivityFeed` — right rail on `xl`, a tab or pull-up sheet below it.
- `StatStrip` / `MetricCard` — 4-up on desktop, 2-up on tablet, horizontal
  snap-scroll carousel on phones rather than a four-row tower.
- Aurora, blur, and glow scale down: cap `backdrop-filter` layers per screen,
  drop the aurora backdrop under `sm`, and disable blur entirely when the
  device signals reduced transparency or low power. Blur is expensive on
  mid-range Android — treat it as an enhancement, never structure.
- Charts and the flow canvas get pinch-zoom and horizontal scroll inside their
  own container; the page body never scrolls sideways.

**Input & ergonomics:** touch targets ≥44px with tap-friendly spacing; hover-only
affordances always have a tap or long-press equivalent; `pointer: coarse` gets
larger hit areas; inputs use the right `inputmode`/`type` so phones show the
right keyboard; no `:hover`-gated tooltips carrying information a mobile user
needs (`JargonTooltip` opens on tap).

**Test matrix every feature ships against:** 360px phone, 768px tablet, 1280px+
desktop, portrait **and** landscape, both themes, plus reduced motion. Honor
safe-area insets and dynamic viewport height (`dvh`) on mobile browsers, and
check one throttled mid-range device before calling a glassy screen done.

- **Accessibility gates the futuristic parts:** glass/glow surfaces must still
  hit 4.5:1 text contrast; focus rings stay visible on every tier; no state is
  communicated by glow or color alone (ticks and labels carry it too).

### Shared primitives to build (used by every feature)

These are the revamp's reusable building blocks — build once, apply everywhere.

**Foundation (Phase 1):**

- `PageHeader` — title, subtitle, breadcrumb, action slot, active-number badge.
- `StatStrip` — wraps `hud-strip`/`hud-stat` for headline metrics.
- `EmptyState` — icon, plain-language explainer, primary CTA, "learn more"
  link. Replaces every blank list/table across the app.
- `DataTable` — sortable, filterable, paginated, responsive-column table on top
  of `responsive-table`, with row-skeleton loading, empty slot, bulk-select bar,
  and saved views.
- `Stepper` — shared progress/wizard chrome (already partly in
  `whatsapp-integration-stepper.tsx`); reused by onboarding, campaign, and
  import wizards.
- Toast/inline-alert, skeleton loaders, and confirm-dialog conventions,
  standardized (replace ad-hoc `use-toast` removal fallout).

**Futuristic layer (Phase 1.5) — what makes it feel next-gen:**

- `CommandPalette` (⌘K / ctrl-K) — search contacts, campaigns, templates, and
  run actions ("send broadcast", "new segment") from anywhere. Biggest
  perceived-modernity win, and a real speed win for power users.
- `AnimatedNumber` — roll-up counter with delta flash; used by every metric.
- `MetricCard` — `hud-stat` + inline sparkline + period-over-period delta + a
  one-line plain-English read ("23% better than your last 5 campaigns").
- `LiveDot` / `StatusPill` — the tick-based status language, one component.
- `PhonePreview` — real WhatsApp-styled device frame (bubbles, ticks, doodle
  wallpaper) rendering a template, campaign, or flow message live as it is
  edited. Preview-before-commit for every send surface.
- `ActivityFeed` — right-rail live ticker of sends, replies, and flow runs.
- `GlassPanel` / `surface-*` utilities — the three-tier elevation system.
- `AuroraBackdrop` — capped ambient gradient for hero/empty/auth zones.

**Clarity layer (Phase 3):**

- `JargonTooltip` / `<Glossary>` — inline plain-language explainers for every
  Meta term (WABA, phone number ID, quality rating, messaging tier, opt-in).
- `PresetGallery` — clone-in-one-click cards for templates, segments, flows.
- `CostBadge` — estimated WhatsApp conversation spend, shown before any send.
- `GuidedChecklist` — dismissible first-run shell (see below).
- `InsightBanner` — one contextual, plain-language suggestion per screen
  ("142 contacts have never received a message — send a welcome?").

### Cross-cutting UX wins the revamp bakes in

1. **Guided first run** — a global onboarding checklist shell (Connect WhatsApp →
   Import contacts → Send first message) surfaced on the dashboard until done.
2. **Plain language everywhere** — `JargonTooltip` on every Meta term; friendly
   status copy instead of `GREEN`/`TIER_1K`.
3. **Consistent empty/loading/error states** via the shared primitives.
4. **Cost visibility** via `CostBadge` before every broadcast.
5. **Responsive/mobile polish** so agents can work from a phone.
6. **Preview before commit** — `PhonePreview` on every screen that eventually
   sends a message; nothing goes out that the user has not seen rendered.
7. **Undo over confirm** — reversible destructive actions (archive, remove from
   segment, pause drip) apply instantly with a 5s undo toast. Modals are
   reserved for the genuinely irreversible (delete, send to 10k contacts).
8. **Progressive disclosure** — every dense form opens in Simple mode with an
   "Advanced" reveal; segments, automation, and campaign scheduling are the
   worst offenders today.
9. **Keyboard-first for power users** — `CommandPalette`, `j`/`k` list nav, `/`
   to search, `esc` to close. Discoverable via a shortcuts sheet (`?`).
10. **Explain the number** — every metric carries a one-line plain-English read
    and a benchmark, not just a figure.

### Rollout phases

- **Phase 0 (done):** design tokens, HUD system, auth revamp (`AuthShell`,
  `PasswordInput`, reset/verify flows). This was the pre-Signal bar — auth,
  flows, and billing shipped against it and now sit at **[Planned]** until they
  pass the definition of done below.
- **Phase 1 — foundation (done):** `PageHeader`, `EmptyState` and `DataTable`
  are applied across every list screen in the product: dashboard, contacts,
  campaigns, templates, segments, drips, drip enrollments, flow sessions,
  team + invitations, API usage, topup orders, flow responses.
  `DataTable` grew into the real shared list surface on the way: per-column
  sorting with empty-values-last, a card layout below `md` driven by each
  column's `card` role (title / meta / body / actions), a toolbar slot, an
  optional pager, skeletons, a real empty slot, and a separate `error` slot —
  a failed fetch and an empty list are different messages and must not read
  as each other.
  The `hide-on-lg/md/sm` column ladder was retuned to 1280/1024/896px. The old
  1024/768/640 rungs sat at or below the width where `DataTable` swaps the
  table for cards, so two of the three could never fire.
- **Phase 1.5 — the system (done):** the full token architecture and theme
  system described above.
  - `app/globals.css` rewritten as a token layer: the semantic scale, seven
    palette families × light/dark, surface tiers, ambient background, motion,
    and the degradation rules (mobile blur, reduced transparency, reduced
    motion). `tailwind.config.ts` exposes all of it and hardcodes nothing.
  - Typography: Inter for reading, Plus Jakarta Sans for display, both via
    `next/font` with the variables on `<html>` — not `<body>`, where a
    `:root` rule cannot see them.
  - Theme system: palette provider + pre-paint bootstrap, `lib/themes.ts`
    registry, and `ThemeSelector` with rendered swatch previews.
  - Component variants: `Card` (default / elevated / soft / highlight /
    interactive / analytics / glass / minimal), `Button` (adds `soft`), the
    form primitives (tinted grounds, themed focus glow, no hard borders),
    shimmer `Skeleton`, illustrated `EmptyState`, glass overlays.
  - Shell: data-driven collapsible sidebar with rail tooltips and lit active
    states, sticky translucent `TopBar` (search, notifications, theme), and
    the fixed ambient background.
  - Primitives: `AnimatedNumber`, `StatusPill`/`Tick`/`LiveDot`,
    `MetricCard`/`MetricRow`/`Sparkline`, `ActivityFeed`, `GlassPanel`,
    `AuroraBackdrop`, `CommandPalette` (⌘K plus a tap trigger).
  - Charts read `--chart-1…6`, so they restyle with the theme.
  - A codemod moved every remaining hardcoded palette class onto the
    semantic scale and dropped the now-redundant `dark:` colour variants.
  - **Next:** `PhonePreview`, and per-screen composition work — the shared
    components restyle every page, but only the dashboard has been
    recomposed editorially so far.
- **Phase 2 — engagement surfaces (done):** inbox, flows, segments, automation.
  Drag-drop upload (§9), the visual flow canvas (§12) and preset galleries
  (§12, §6) landed earlier. Added here:
  - **Inbox** rebuilt — tinted outgoing bubbles, sender grouping, sticky day
    separators, a corrected tick language, a working emoji picker, and one
    pane at a time below `md`.
  - **Segments** — the rule tree now reads back as a sentence before you
    save it, `Explain` on the three condition types nobody can guess, joining
    words spelled out between rows, match count on `StatStrip`, sample on
    `DataTable`.
  - **Automation** — conditions and priority folded into a *Fine-tuning*
    section so a first rule is just a trigger and an action; the fold opens
    itself when either is already in use. Rules list on `DataTable`.
- **Phase 3 — trust & clarity:** analytics benchmarks, cost previews, number-
  health explainers, `Explain` rollout, guided first-run checklist,
  `InsightBanner`.
  - **Cost previews (done)** — `components/cost-estimate.tsx` is the one place
    a send is priced: `useCostEstimate` for a single template against an
    audience, `useSequenceCost` for a whole drip (each step priced, repeated
    templates fetched once, results added by `lib/cost.ts`), and the
    `CostEstimate` panel they both render into. The campaign composer moved
    onto it; drip enrolment by tag now prices the entire sequence, not its
    first message. Where there is no audience to price — one template to one
    person from the inbox, or an automation rule's reply — `ConversationChargeNote`
    states what will be charged instead of inventing a figure. Drip steps carry
    a `TemplateCategoryBadge`, since marketing and utility are what make one
    step cost more than the next. The flow send dialog says the opposite: a
    flow is an interactive message, so the backend rejects it unless the
    24-hour window is open, which makes it a free service message.
  - **Billing model, corrected against the backend.** `MetaRate` is "Meta's
    per-message cost by (country, category)" and `WalletEntry` debits are keyed
    UNIQUE on the Meta message id — the product bills **per message**, on the
    category in Meta's delivery status, and only when that status is billable
    (`service`, or `billable: false`, is free). Copy across the app said "per
    conversation", and the inbox note said a contact's reply made a template
    free; a reply opens a free *service* window, which templates are priced
    separately from. Fixed in `lib/glossary.ts`, the campaigns empty state,
    profile billing card, and the new cost components.
  - **`InsightBanner` (done)** — one contextual suggestion per screen, on the
    dashboard, contacts, campaigns and drips. Rules live in `lib/insights.ts`
    as pure functions with tests, ordered by consequence so exactly one can
    fire; each carries a materiality bar, because a 33% failure rate over six
    sends is arithmetic, not a finding. The dashboard's own inline version —
    three hardcoded thresholds that disagreed with `lib/benchmarks` — was
    replaced by it, and the rule set deliberately says nothing about delivery,
    read or failure rates there, since `RateInterpretation` sits directly below
    and already explains them. Banners dismiss for seven days rather than
    forever: a wallet runs low again, a sequence gets switched off again.
    What each screen says: contacts, the share of the list with no opt-in
    recorded; campaigns, the last completed send's failure rate or its missing
    link tracking; drips, a switched-off sequence still holding enrolments, then
    a running one with no stop conditions.
  - Still open: analytics benchmarks beyond the dashboard, and `Explain` on
    campaigns, drips, flows, api-usage and pricing.
- **Phase 4 — placeholder→live:** redesign billing, notifications, docs, admin
  as their backends land.

### Definition of done per screen

A section may be re-tagged `[Revamped]` only when all of these hold:

- Uses `PageHeader`, and `EmptyState` for every empty list.
- Tabular data goes through `DataTable`; metrics through `MetricCard`/`StatStrip`
  with `AnimatedNumber`.
- Status shown with the tick-based `StatusPill`, never a raw API enum.
- Loading is skeletons, not spinners; errors are inline and actionable.
- Verified at 360 / 768 / 1280px, portrait and landscape, both themes, and with
  reduced motion on. No horizontal page scroll at any width.
- Touch targets ≥44px; every hover-only affordance has a tap equivalent.
- No hard-coded color, radius, or duration value.

---

## 1. Sign up & log in **[Live] [Planned]**

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

**Meta Embedded Signup (P0-GTM, live).** The one-click path is `ConnectWhatsApp
Button` → `lib/facebook-sdk.ts` (`launchEmbeddedSignup()`, `config_id`,
`response_type=code`, `sessionInfoVersion` 3) → `submitEmbeddedSignup(code)` →
`POST /auth/facebook/embedded-signup`. A registration failure surfaces as a soft
warning, not a dead end — the account is still linked. Env:
`NEXT_PUBLIC_FACEBOOK_APP_ID`, `_ES_CONFIG_ID`, `_GRAPH_VERSION` (zod-validated).
`NEXT_PUBLIC_SUPPORT_EMAIL` is optional — it gates the support page's contact
route, which says so plainly when unset rather than showing a dead address.

**OAuth `state` is the client's job (P1-MIGRATION).** The backend builds the
redirect login URL with a hardcoded `state` (`auth.service.ts:401`) and never
verifies it, so `lib/oauth-state.ts` overwrites it with a random per-tab nonce in
`sessionStorage` and `FacebookCodeHandler` refuses any callback whose `state`
doesn't match — single-use, so a replay fails too. Without it, a crafted link
carrying an attacker's `code` would be exchanged against the victim's session
(authorization-code injection). Embedded Signup doesn't need this: its code
arrives through an SDK callback in a popup, never off a URL.

**Token health (P0-GTM, live).** `FacebookAccount` carries `needsReauth` +
`tokenExpiresAt`. `TokenHealthBanners` on the WhatsApp page shows a red re-link
banner when the Meta token is dead (reusing the same connect flow) and an amber
notice when it expires within 7 days — so a silently expired token stops looking
like "the product is broken."

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

**Design revamp — shipped.**
- The whole rule tree is read back as one sentence above the match count:
  "Contacts who *have tag vip and were inactive for 30 days*". A tree of
  dropdowns can be filled in correctly and still not say what someone meant,
  especially once a nested group mixes AND with OR — `describeGroup()` in
  `lib/segment-rules.ts` is what makes the nesting safe to offer.
- Rows read as sentences: joining words between the controls, and the
  group's AND/OR spelled out as a chip between the rows it joins rather than
  only as a setting above them.
- `Explain` on **custom attribute**, **conversation activity** and **campaign
  behaviour** — the three condition types with no guessable meaning. Tag and
  contact field are ordinary English and are left alone. Two new glossary
  entries back these.
- Live match count on `StatStrip`; the sample audience on `DataTable`, with
  an empty state that says which way to loosen the rule.
- `StarterLibrary` + `SEGMENT_STARTERS` already cover the preset gallery.

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

**24-hour window + honest send state (P1-MIGRATION, live).** `useSessionWindow`
calls `GET /whatsapp/session-window` for the open thread; when `open` is false
the free-form input, attachment, and interactive buttons are **disabled** with a
banner naming when the contact last wrote, leaving the template picker as the way
through — the rule is learned from a greyed-out box, not a rejected send. A send
that still 400s is matched on code **131047**, never message text, and
re-invalidates the window. While the window is open the composer shows a live
countdown off `expiresAt`. Send responses carry `deliveryStatus: 'accepted'`,
which renders as plain **"Sent"** — one tick, "queued by WhatsApp, not delivered
yet"; only a webhook status event upgrades it to delivered/read, and it can still
end as `failed` long after being accepted. The
optimistic bubble is replaced when the delivery webhook's real row arrives,
matched on `waMessageId`.

**Read cursor — fixed 2026-08-22 (backend).** The badge used to come back
after navigating away from the inbox: `conversation_read_state` had zero
rows, so unread was recomputed from scratch on every visit. The POST to
`/chat/conversations/:id/read` was failing at runtime and the frontend was
swallowing it into `console.error` — a failed write whose only visible
effect is a badge not disappearing is invisible by construction. Fixed on
the backend; the frontend now reports a failed read-write once per session
with the real error rather than hiding it, and clears the badge locally for
the thread on screen so the list is right while you are reading it.

**Latent, related, backend-owned.** `whatsapp_event.receivedAt` is
`timestamp` (no time zone) while `conversation_read_state.lastReadAt` is
`timestamptz`, and the unread query compares them directly:
`e."receivedAt" > r."lastReadAt"`. Postgres resolves that using the session
time zone. Dates are written as local wall-clock, so this is only correct
while the database session runs in the same zone as the Node process — it
does today (both Asia/Calcutta), which is why this is not the bug above. Put
the database in UTC, as most hosts do, and every message younger than the
offset stays unread forever. Both columns should be `timestamptz`.

**Missing / improve for newbies:**
- ~~Media send takes a **URL, not a file upload**.~~ — **shipped.**
  `POST /whatsapp/media` (`WHATSAPP_ENDPOINTS.UPLOAD_MEDIA`) landed and
  `uploadWhatsappMedia` is wired: the attachment dialog is upload-or-link
  (tabs), and a file dropped anywhere on the thread attaches it.
- No canned/quick replies for common questions.
- No emoji picker (button exists but inert).
- **Suggested:** a saved quick-replies library.

**Design revamp (planned):**
- Three-pane inbox: conversation list, thread, contact/context panel — full
  `chat-bubble-in`/`chat-bubble-out` styling, dark-mode aware.
- ~~**Drag-drop file upload** zone replacing URL-only media send.~~ — **built.**
  `components/chat/attachment-dialog.tsx` pairs an upload drop zone with the
  URL tab, and `app/dashboard/chat/[chatId]/page.tsx` accepts a file dropped
  anywhere on the thread. Size and type are pre-checked by
  `lib/media-upload.ts` before the request starts.
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

## 11. Automation — rules **[Live] [Planned]**

**What it does:** "When this happens, do that." Each rule is one **trigger**
(keyword, button tap, new contact, tag added, or nobody replied for N hours),
optional **conditions** (tag / contact field / opt-in state / message text,
combined with and/or), and an ordered list of **actions** (send text, send
template, add or remove a tag, set a field, assign a teammate, start a flow,
call a webhook). Priority orders the rules; only the first match fires per
event.

**Business example:** Someone texts "hours" → send your opening times and tag
them `enquiry`. Nobody replied for 48 hours → send a follow-up template. A
contact gets tagged `vip` → assign them to your best agent.

**Frontend notes:**
- Validation mirrors the backend zod schema in `lib/automation-rules.ts` so
  mistakes surface inline instead of as a 400 — every limit there is copied from
  a server constraint, not invented.
- An emptied condition group is sent as `null`, not `{ combinator, conditions: [] }`,
  which the server rejects.
- The list warns when a rule "never runs": an active, unconditional catch-all at
  the same-or-lower priority number on the same phone number swallows the event
  first. Scoped to keyword triggers on both sides, because the engine matches
  the trigger type against the event type before anything else.
- Branching stays in Flows. A rule that needs to ask and route uses the
  `start_flow` action rather than growing a second graph editor.

**Missing / improve for newbies:**
- No analytics on how often each rule fires (the backend records an
  `automation_run` ledger row per rule+event for idempotency, but exposes no
  endpoint over it).
- **Suggested:** rule hit counts, and a dry-run "what would this do" preview.

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
- ~~The builder is a form-based node list, not a drag-and-drop visual canvas.~~
  — **shipped**, see the canvas below.
- ~~No flow templates to start from.~~ — **shipped.** `lib/flow-starters.ts`
  backs the starter library on the flows list (welcome menu, lead capture, order
  status, out-of-hours).
- ~~No delay/wait or conditional-on-variable nodes yet.~~ — **shipped.** Both
  `delay` and `condition` nodes exist, with the delay capped at 24 hours.
- **Suggested:** node-level analytics (how many sessions took each branch).

**Design revamp:**
- ~~**Drag-and-drop visual graph canvas** replacing the form-based node list —
  nodes as cards, branches as edges, live validation panel docked beside it.~~
  — **built** on `@xyflow/react`, in `app/dashboard/flows/flow-canvas.tsx`:
  - Every node is a card; every **outgoing target is its own port** with its own
    handle (`lib/flow-graph.ts`), so dragging from "Button 2" writes that
    button's target and nothing else. Ports carry their own label — the button's
    title, or a branch read back as "answer is exactly yes" — which is also the
    edge label, and a port with no target says whether that means "needs a
    target" or "ends flow" right on the card.
  - The **palette drags onto the canvas** (or click to drop a node in place);
    selecting an edge and pressing Delete unlinks it. `Delete` is bound but
    **Backspace deliberately isn't** — it is the key people reach for while
    editing text in the inspector docked beside the canvas.
  - The per-node form moved to `flow-node-editor.tsx` and now edits the
    **selected** node next to the canvas, alongside the validation panel and the
    simulator. A validation issue is a button: clicking it selects the node it
    belongs to, which matters once a card can be off-screen.
  - **Layout is derived, then saved.** `lib/flow-layout.ts` derives a
    left-to-right layout from the graph itself — breadth-first from the entry
    node, unreachable nodes as visible islands to the right — so a flow nobody
    has arranged still reads well. Hand-drags are saved with the flow in
    `definition.layout` (backend `e5d3e35`: an optional node-id-keyed record the
    engine never reads, capped at 200 entries), so an arrangement follows the
    flow to another machine and to teammates. `localStorage` now only carries
    drags on a flow that has never been saved and loses to a saved layout;
    "Auto arrange" returns to the derived one.
  - **Button reply ids.** Each button carries the id Meta echoes back on a tap,
    which is what the engine matches a branch on. It is optional on the wire and
    backfilled server-side as `<nodeId>-<index>`, but the builder assigns one as
    a button is added (`appendButton`): deleting the first of `menu-0, menu-1`
    and adding a button would otherwise derive `menu-1` for the new one, and the
    save would be rejected as a duplicate.
- ~~`PresetGallery` of starter bots (lead capture, FAQ, appointment booking).~~
  — **shipped** as `components/starter-library.tsx`.
- Simulator restyled as a real WhatsApp thread (`chat-bubble-*`) for realistic
  test chats. **Still planned.**

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

## 15. Billing — prepaid wallet **[Live] [Planned]**

**What it does:** The account runs on **prepaid credit**, not subscription tiers.
`/dashboard/billing` shows the wallet balance, a Razorpay top-up dialog, payment
history, and a server-paginated statement of every charge. `lib/money.ts` formats
currency-aware, sub-unit amounts — WhatsApp conversation pricing is a fraction of
a unit and varies by country, so **never hardcode a currency symbol** here.

**Currency is the response's, never ours.** The backend bills in **INR**
(`BILLING_CURRENCY`, and each account carries its own `billingCurrency`). Every
money response ships a `currency` next to the amount and that is the only source
— `lib/money.ts` exports `FALLBACK_CURRENCY` purely so a pre-load render doesn't
crash, not as a default to lean on. An Indian marketing message is ~₹1.22, so
sub-unit precision matters. Top-up presets are whole units (500/1000/2000)
rendered through the wallet's currency, inside the backend's
`RAZORPAY_MIN_TOPUP..MAX_TOPUP` (1..100000).

**Top-up path (P1-MIGRATION):** `POST /billing/topup/order` → `lib/razorpay.ts`
opens Checkout with `{ orderId, keyId, amountMinorUnits, currency }` — Checkout
takes **`amountMinorUnits`** (paise); the sibling `amount` is whole units for
display, and passing it charges 1/100th. `GET /billing/topup/orders` rows are the
other way round: already whole units (the backend converts from micros), so they
are not divided again. A Razorpay **webhook** then credits the wallet. `TopUpDialog` therefore goes to a
*confirming* state on Checkout success and polls `GET /billing/wallet` (comparing
`balanceMicros`, so a sub-cent credit still registers) until the balance moves;
after ~30s it says "payment received, balance updating" rather than claiming
failure. Nothing credits optimistically, and a dismissed Checkout is not treated
as proof no payment happened. `POST /billing/credit` is admin-only and unused by
the customer UI. `TopupOrdersTable` renders `GET /billing/topup/orders` —
amounts there are **minor units**, divided by 100 for display.

**Where the money went:** `UsageByFeatureCard` reads `GET /billing/usage` —
spend grouped by the feature that sent each message (broadcasts, drips,
auto-replies, bot flows, inbox replies, opt-in confirmations, your API), over
7/30/90 days or all time, with the same `lib/message-source.ts` labels the
statement's "Sent by" column uses. **Debits only**, so the total never
reconciles against the wallet balance or the payment history and the card says
so. Charges written before attribution existed come back as `unattributed` and
are labelled "Before tracking" — the backend resolves the source from the wamid
at send time, so an un-sourced charge can never be filled in afterwards.

**Business example:** Priya tops up ₹2,000, watches it draw down per
conversation on the statement, sees that drips are eating more of it than
broadcasts, and gets warned before it runs dry mid-campaign.

**How it fails safe:** `WalletBalanceCard` turns amber when the balance is low
and red at zero; `LowBalanceBanner` is global at ≤ 0. Any backend **402** from
`apiRequest` broadcasts `WALLET_EXHAUSTED_EVENT`, and `WalletExhaustedProvider`
opens the top-up modal from wherever the user was — an exhausted wallet never
shows up as a generic failed request. Data via `useWallet` / `useBillingEntries`
(TanStack).

**Missing / improve for newbies:**
- No **cost preview before a broadcast** — the wallet knows the balance but the
  campaign composer never estimates spend against it. Highest-value follow-up
  (this is also cross-cutting gap #2).
- No auto-recharge threshold, no spend alerts, no invoice/receipt download.
- Statement rows are raw charges — no per-campaign rollup.

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
| **Contacts `attribute-keys`** (`GET /contacts/attribute-keys` — distinct custom-attribute keys) | ✅ Built | ✅ **Wired** | ✅ Done | `CONTACTS_ENDPOINTS.ATTRIBUTE_KEYS` + `getContactAttributeKeys` feed all three builders (`segment-builder.tsx`, `drip-builder.tsx`, `new-campaign-dialog.tsx`). The client-side sample of `listContacts` is kept only as a **merge fallback**, so a failed keys call still yields a usable list |
| Inbound **media download proxy** (`GET /whatsapp/media/:mediaId/download`) | ✅ Built | Partial | Partial (§9) | Ensure inbox renders inbound media through the proxy (Meta URLs need the token) |
| Phone-number **quality/tier** (`GET /whatsapp/phone-numbers`) | ✅ Built | Partial | ✅ (§13) | Surface tier limits + plain-language health (see §13 revamp) |

**Backend gaps that constrain the frontend (don't build UI ahead of these):**
- ~~**Binary media upload** endpoint not built (link/mediaId only).~~ — **DONE.**
  `POST /whatsapp/media` (multipart `file` + `type`) returns a media id valid
  for 30 days, scoped to the phone number it was uploaded for. The inbox
  drag-drop upload (§9) is built on it and no longer blocked.
- ~~**Click/CTR tracking** not built.~~ — **DONE.** `POST /links` / `GET /links`
  plus the public `/r/:token` redirect landed (`LINKS_ENDPOINTS`,
  `createTrackedLink`/`listTrackedLinks`), and campaign sends rewrite bare-URL
  template parameters automatically. The "clicked" segment condition and CTR in
  analytics (§8) are built on it.
- ~~**Messaging-tier cap** surfaced~~ — **DONE (two-repo change).** The
  dispatcher gates each number to its tier's daily unique-recipient allowance
  and auto-defers a campaign (recipients stay `pending`) when the cap is hit.
  It now **persists** that: `deferredReason` / `deferredAt` / `deferredUntil` on
  the `Campaign` entity, set at the full-stop and cleared when the 24h window
  rolls, the tier is upgraded, or the campaign completes/cancels. Status stays
  `running` deliberately — a new status value would have broken the analytics
  `COUNT(*) FILTER` clauses, the `cancel()` guard, and every frontend filter, so
  deferral is a **modifier on `running`**, checked separately.
  Frontend: `CampaignDeferredBanner` on campaign detail explains the tier limit
  in plain language with a resume estimate, and `CampaignStatusBadge` renders
  "Waiting on daily limit" instead of a pulsing "Running" for something sending
  nothing. `deferredUntil` can lapse (concurrent campaigns on one number can
  overshoot the cap, and it isn't re-stamped while the deferral holds), so a
  past estimate degrades to a vaguer honest message rather than showing a stale
  time. (Follow-up still open: unknown-tier numbers are uncapped until the first
  quality webhook — `tierToCap` returns `Infinity`, so a brand-new number never
  defers and the frontend can't detect it.)
  The same deferral mechanism now also carries `insufficient_balance` (empty
  wallet), which gets its own banner and badge — see the drift section below for
  why the two reasons deliberately don't share copy.
- **Quality-drop alerts** done and wired (Notifications). Only **email/push
  delivery** of alerts is still deferred (currently DB row + WARN log).
- **Billing/wallet, CTWA ads, e-commerce, Zapier/public API, native WhatsApp
  Flows** — all P2, **not built** → keep those frontend screens as honest
  `[Placeholder]` "coming soon," not fake data.

**Net (after the 2026-08-15 catch-up):** every backend endpoint has a frontend
consumer again, `GET /billing/usage` included, and every response field we
receive is modelled — see "Backend moved ahead of the frontend" below for what
drifted and how each was closed. Drips and Alerts were the last two doc gaps;
conversational automation turned out to be already wired in WhatsApp onboarding
(step-4); `contacts/attribute-keys` is wired into all three audience builders.

**The remaining gaps are backend-side, not wiring** — see "Backend gaps that
constrain the frontend" above. Two are worth a coordinated two-repo change (the
`backend-wb` repo is on the same machine, as Phase 4 did):

1. ~~**Tier-cap deferral is invisible.**~~ — **DONE**, both repos. See the
   messaging-tier bullet above.
2. **No pre-broadcast cost estimate.** Billing already has everything required —
   a `country:category` rate card in micros, markup, and tax
   (`billing.service.ts`, `country-from-phone.ts`) — but `billing.controller.ts`
   exposes only `wallet`, `entries`, `usage`, `topup/order`, `topup/orders`,
   `credit`.
   A `GET /billing/estimate` would unlock the campaign-composer cost preview
   that closes cross-cutting gap #2.

### Backend moved ahead of the frontend (drift found 2026-08-15) — **closed**

Re-checked against `backend-wb` HEAD `910e41f`. Five backend commits landed
after the last frontend sync; four of them changed or added surface we consume.
All four are now caught up — kept here because each one records a decision, and
because this is the drift pattern to re-run whenever the backend moves.

1. ~~**Automation is a rule engine now and our UI speaks the dead schema.**~~ —
   **DONE.** `910e41f` + migration `1784330624729-AutomationRuleEngine` replaced
   `matchType` / `keywords` / `replyType` / `replyText` / `replyTemplateName` /
   `replyTemplateLanguage` with `triggerType` + `trigger` / `conditions` /
   `actions` jsonb, and **dropped the old columns** (existing rows were converted
   in place — every old rule is a `keyword` trigger with one send action — so no
   data was lost). Creates and updates were failing validation outright.

   The whole builder was rewritten against the new vocabulary: `services/api.ts`
   now models trigger / conditions / actions as discriminated unions,
   `lib/automation-rules.ts` mirrors the zod constraints for inline validation,
   and the dialog is three editors (`rule-trigger-editor`,
   `rule-conditions-editor`, `rule-actions-editor`) over one form state. Details
   worth not re-deriving:
   - **An emptied condition group is sent as `null`.** `{ combinator, conditions: [] }`
     fails the server's `.min(1)`, and "no conditions" is exactly what `null`
     means — so removing the last row removes the group.
   - **The old "only one active catch-all per number" client guard is gone.** The
     server never enforced it, and with priority ordering a second catch-all is
     legal, just usually pointless. It was replaced by a *"never runs"* warning
     on the rules it actually shadows, which is the real problem it was
     gesturing at.
   - **Shadow detection is scoped to keyword triggers on both sides**, because
     the engine compares `trigger.type` to the event type before matching
     anything — a keyword catch-all can't shadow a `new_contact`, `button`,
     `tag_added` or `no_reply` rule. A catch-all carrying conditions doesn't
     shadow either: it can decline to fire.
   - **Editing clones the rule** (`structuredClone`) so a cancelled edit leaves
     the list untouched.
   - `lib/automation-rules.test.ts` (33 cases) pins the boundaries the server
     would 400 on, plus every shadow-detection edge above.

   Copy that described automation as "one keyword in, one reply out" was
   rewritten in the glossary, the which-one-do-I-use picker, and §11.
2. ~~**`deferredReason: "insufficient_balance"` is unhandled.**~~ — **DONE.**
   `888223f` pauses a campaign on an empty wallet by deferring it, reusing the
   tier-cap mechanism. The two reasons get **separate banner copy on purpose**:
   a tier cap clears itself on a clock and the honest advice is to wait, an
   empty wallet never clears without a top-up. Telling someone to sit tight
   while their broadcast is frozen on a payment is the worse of the two errors,
   so the wallet banner says "this does not clear by waiting" and links to
   Billing. The badge splits too — "Needs a top-up" vs "Waiting on daily limit".
   `deferredUntil` is only ever set for `tier_cap`, so no resume estimate is
   shown for a wallet stall.
3. ~~**`GET /billing/usage` has no consumer.**~~ — **DONE.** `9d76100` attributes
   every debit to the feature that caused it. `UsageByFeatureCard` on the
   billing page shows spend per source over 7/30/90/all-time. Two honesty
   constraints: the card says **top-ups aren't included** (it's debits only, so
   the total can't be reconciled against the wallet or the payment history), and
   `unattributed` is labelled "Before tracking" with an explanation rather than
   dressed up as "Other" — attribution can only ever be recorded going forward,
   so that bucket shrinks as old charges age out but never gets filled in.
4. ~~**`BillingEntry.source` is dropped on the floor.**~~ — **DONE.** The
   statement has a "Sent by" column reading the same
   `lib/message-source.ts` labels as the usage card, so a row and the breakdown
   can't name the same feature differently. Null (credits, pre-attribution
   debits) renders as an em dash, never "null".

---

## Placeholder / not-yet-real screens

These exist in the navigation but currently show **static or mock data**, not
live backend features:

- **API usage** **[Live]** — rebuilt on real analytics. It previously rendered
  ~360 lines of pure fabrication: invented account names ("Acme Support"),
  per-endpoint call counts, latency percentiles, and error-rate tables, none of
  which the backend measures. It now shows only genuine inbound/outbound message
  volume (`getAnalyticsOverview` + `getMessagingAnalytics`), with per-endpoint
  metrics left as an honest "not tracked yet" `EmptyState`.
- ~~**Subscription / billing** **[Placeholder]**~~ — **removed.** The mock
  `/dashboard/subscription` page (hardcoded user, fake invoices, fake saved card,
  `alert()` on upgrade) was deleted along with its only consumers,
  `lib/subscription-plans.ts` and `lib/user-model.ts`, and its sidebar entry.
  Billing is now the live prepaid wallet at `/dashboard/billing` (§15) — the
  product bills per conversation, not per plan tier.
- **Notifications** **[Live]** — now wired to the backend `AlertsModule`. Shows
  real number-health alerts (quality GREEN/YELLOW/RED/FLAGGED) with
  plain-language "what to do" advice, mark-as-read (single + all), and
  loading/empty/no-account states. Responsive.
- **Documentation** **[Honest]** — the **API Reference** and **Webhooks** tabs
  were deleted, not restyled: they documented a customer-facing REST API
  (`POST /messages`, `Authorization: Bearer YOUR_API_KEY`, "generate API keys in
  your account settings") and user-configurable webhooks. Neither exists — the
  public API is unbuilt P2 and there is no API-key concept anywhere in
  `services/api.ts`. Remaining: guides pointing at **real** destinations
  (in-app routes, or Meta's own docs with `rel="noopener noreferrer"`) and an
  accurate FAQ. A non-functional search box went too; the seven `href="#"` dead
  links are gone.
- **Support** **[Honest]** — the ticket form is removed. It collected a
  category, subject, description and attachment, sent none of it anywhere
  (`// In a real app, you would submit the ticket to an API`), then displayed
  **"Your support ticket has been submitted successfully."** A user with a
  production problem would write it up, be told it was received, and wait
  forever. Contact is now email, gated on a new optional
  `NEXT_PUBLIC_SUPPORT_EMAIL`; unset, the page says contact isn't configured
  rather than showing the old `support@example.com` / `+1 (555) 123-4567`.
- **Users (super admin)** **[Honest]** — five invented users with fake statuses
  and **subscription tiers that are no longer a product concept** replaced by an
  `EmptyState` pointing at Team settings, which is real.
- **Profile** **[Live]** — was a hardcoded "John Doe / john@example.com / Super
  Admin" shown to every user, plus a **Subscription Details card with a fake
  saved card ("Visa ending in 4242"), plan, billing address and next-billing
  date** — the same fabricated billing content already deleted once with the
  mock `/dashboard/subscription` page. (`AuthUser` has no `role` field, so the
  badge was rendering a constant over `undefined`.) Now reads the real session
  and shows the live wallet balance. The edit/password forms were removed rather
  than left inert — there is no profile-update or change-password endpoint.
- **Settings** **[Honest]** — rewritten as a hub. Every control was local
  `useState` with nothing behind it, and one was a security hazard: a
  **two-factor-authentication toggle that displayed "Two-factor authentication
  is enabled."** while doing nothing, so a user could believe their account was
  protected when it was not. Also removed: a fabricated `sk_live_***` API key
  with invented dates, a hardcoded webhook URL + `whsec_***` secret, an invented
  session record, and a duplicate fake profile tab. Team remains real; password
  routes to the working reset-link flow.
- **Sidebar** — showed a hardcoded `Super Admin / admin@example.com` on every
  page to every user; now reads the real session.

**Design revamp (planned, Phase 4 — as backends land):**
- ~~All placeholder screens get the shared `PageHeader` + `EmptyState`
  ("coming soon" honest state) instead of fake data~~ — **DONE.** Swept every
  placeholder screen above. A repo-wide grep for fabricated markers
  (`sk_live_`, `whsec_`, `api.example.com`, `support@example.com`,
  `admin@example.com`, `john@example`, `Acme Inc`, `ending in 4242`,
  `(555) 123`) now returns only commented-out code. Nothing looks live when it
  isn't.
- **Billing:** done (§15) — wallet card, top-up dialog, and statement table are
  built. Remaining: usage meters (`hud-stat` mono) and `CostBadge` for
  conversation spend, reused in the campaign composer.
- **Settings:** density toggle (comfortable/compact), theme, and the glossary
  live here; tabs restructured with the shared primitives.
- **Admin/Users:** `DataTable` with role/status chips once real management
  exists.

---

## Cross-cutting gaps that hurt newbies most

1. ~~**No onboarding/guided first run.**~~ — **DONE.** `SetupChecklist`
   (`components/setup-checklist.tsx` + `hooks/use-setup-checklist.ts`) renders on
   the dashboard and walks a new account from empty to first message sent:
   connect WhatsApp → register a number → add contacts → get a template approved
   → add wallet balance → send. **Every step's done-state reads a real backend
   signal** (`listWhatsappPhoneNumbers` status, `listContacts` total,
   `listWhatsappTemplates` APPROVED, `getWallet` balance, and lifetime
   `getAnalyticsOverview().messaging.outbound`) — nothing is tracked
   client-side, so it stays correct on a new device and can't drift from the
   account's actual state. Local `localStorage` dismissal is the one exception
   (a UI preference, not account state); the card also self-hides once all six
   pass, costing an established account no space. Steps whose prerequisite isn't
   met render a disabled CTA rather than a link that dead-ends.
2. **No cost visibility — half closed.** The wallet (§15) now shows balance,
   spend history, and low/empty warnings. What's still missing is the
   *forward-looking* half: no estimate of what a broadcast will cost **before**
   you send it, which is the part that blindsides small businesses.
3. ~~**Jargon everywhere.**~~ — **DONE.** `lib/glossary.ts` defines every Meta
   term the UI shows (WABA, phone number ID, quality rating, messaging tier,
   24-hour window, template category/status, opt-in, conversation, …) in plain
   language, once. `components/explain.tsx` reads it for inline hover/focus
   tooltips — `<Explain term="waba">copy</Explain>` underlines existing text,
   `<Explain term="waba" />` drops a `?` next to a label — and
   `/dashboard/glossary` renders the same entries as a searchable page, so a
   tooltip and the glossary can't disagree. `term` is typed to the union of
   entry ids, so a typo is a compile error rather than a silently blank
   tooltip. Wired in at the raw-jargon sites: the WhatsApp accounts table
   (Business Name, Status, Quality, Daily Limit), onboarding step-3 (WABA ID,
   Phone Number ID), the inbox's closed-window notice, the templates page
   (template, category, status), the contacts Status column, Segments (segment,
   attributes), Billing (wallet, conversation), and Notifications — which also
   stopped printing Meta's raw `TIER_1K` enum and now shows the daily number via
   `messagingTierLabel`.

   Five entries are glossary-only by design, not oversight: `automation`, `flow`
   and `drip` get the fuller side-by-side treatment in the picker note below
   (#7) rather than a tooltip; `opt-out` is covered in place by the contacts
   page's existing per-contact status tooltip, which knows *why* that specific
   person is opted out; and `number-registration` has no anchor short of
   converting `hooks/use-setup-checklist.ts` to `.tsx` to hold JSX descriptions,
   which isn't worth it while those descriptions are already plain language. A
   glossary entry with no in-app tooltip is still doing its job — the terms turn
   up in Meta's own docs and in support conversations, and the page is
   searchable.
4. **No templates to start from.** Contacts, segments, campaigns, and flows all
   start from a blank slate. Clonable presets would dramatically lower the entry
   bar.
5. ~~**File upload gap in the inbox.**~~ — **closed.** Media is uploaded from the
   composer (drop a file on the thread, or the attachment dialog's upload tab);
   the URL field stays as a second option rather than the only one.
6. **No mobile app / responsive polish** for agents replying on the go.
7. ~~**Overlap between Automation and Flows**~~ — **DONE.**
   `components/automation-picker-note.tsx` renders a three-way "Which one do I
   use?" comparison — Automation (one keyword, one reply), Chatbot flow
   (branches on the answer), Drip sequence (time-driven, no reply needed) — with
   one line of guidance and one concrete example each. It sits at the top of
   `/dashboard/automation`, `/dashboard/flows` and `/dashboard/drips`, with the
   current page marked "You're here" and rendered as a `div` rather than a link
   back to itself; the other two link across. Drips were folded in because they
   are the third feature in the same confusable set, not just Automation vs
   Flows.

## Suggested "newbie mode" roadmap (highest impact first)

1. ~~Guided setup checklist on first login.~~ — **shipped** (see cross-cutting
   gap #1 above).
2. ~~Plain-language tooltips + a glossary for every Meta term.~~ — **shipped**
   (see cross-cutting gap #3 above). The "which one do I use?" explainer for
   Automation / Flows / Drips shipped alongside it (gap #7).
3. ~~Starter libraries: templates, segments, and flow bots you clone in one
   click.~~ — **shipped.** Templates already had `TEMPLATE_PRESETS`; segments
   and flows were still blank-slate. `lib/segment-starters.ts` (5 audiences:
   recently active, gone quiet, campaign readers, received-but-never-replied,
   opted out) and `lib/flow-starters.ts` (4 bots: welcome menu, lead capture,
   order status, out-of-hours) now back a shared
   `components/starter-library.tsx` picker on both list pages. Cards deep-link
   to `?starter=<id>`; an unknown id falls through to a blank builder rather
   than erroring, so a stale bookmark isn't a dead end.

   Both builders take a `starter` prop kept **separate from** `segment`/`flow`:
   passing a synthetic entity would flip `isEdit` and make the builder PATCH an
   id that doesn't exist. Flow definitions are `structuredClone`d on seed — the
   starter module is a shared singleton and the builder mutates nodes in place.

   `lib/starters.test.ts` (33 cases) asserts every starter is valid *on
   arrival*: flows pass `validateFlow` with zero issues, segment operators are
   ones `operatorOptionsFor` actually offers for that condition type, and no
   flow question writes to `name`/`waId` — those are built-in tokens resolved
   ahead of collected variables in the backend's `renderText`, so such a
   question is silently shadowed at send time. None of that is compiler-checked,
   and the failure mode is a user clicking a template and landing on a builder
   that opens with errors already showing.
4. Estimated cost preview before any broadcast.
5. ~~Drag-drop file upload in the inbox.~~ — **shipped.**
6. ~~A single contact profile/timeline view.~~ — **shipped.**
   `/dashboard/contacts/[contactId]` holds identity, tags, attributes, the full
   consent record (state, source, timestamps, plus the STOP-unsubscribe warning)
   and the message history with that person. Reached from the contacts list by
   clicking a name; links on to the inbox thread.

   Three things worth knowing about it:
   - **`getContact` was missing from the frontend only.** `GET /contacts/:id` and
     `CONTACTS_ENDPOINTS.GET` both already existed — just no wrapper in
     `services/api.ts`. Added, with `retry: false` on `useContact` so a 404
     settles into the not-found state instead of spinning through backoff.
   - **The timeline reuses the inbox's `mapChatEvents`** (exported from
     `hooks/use-chat-messages.ts` for this). Payload shapes — media under
     `payload.<type>`, templates, interactive replies, Meta's `unsupported` — are
     fiddly enough that a second implementation would drift. It's read-only:
     replying stays in the inbox, which owns the 24-hour-window check and send
     path.
   - **Campaign and drip history is deliberately absent.** Both exist only as
     per-campaign (`listCampaignRecipients`) and per-drip
     (`listDripEnrollments`) endpoints; there is no reverse index from a contact
     to the sends that touched them. Assembling it client-side would fan out
     across every campaign and drip on the account, so it waits on a backend
     endpoint rather than shipping slow or fabricated. **This is the one open
     gap on the page.**

   Consent helpers (`optedOutViaStop`, `optStatusTooltip`, `formatOptTimestamp`,
   `OPT_IN_SOURCE_LABELS`) moved out of the contacts page into
   `lib/contact-consent.ts` so both screens read consent identically — a contact
   shown as re-openable on one screen and locked on the other is a compliance
   problem, not a cosmetic one.
7. ~~Benchmarks and interpretation on the analytics dashboard.~~ — **shipped.**
   `lib/benchmarks.ts` centralises the thresholds, hint wording and tile tone
   for delivery / read / reply / failure rates; the dashboard tiles, the
   campaign detail tiles and the new `components/rate-interpretation.tsx`
   panel all read from it, so they can't disagree about what "good" is. The
   panel is the interpretation half — what the number means and what to do —
   sorted worst-first, filtering out anything with nothing worth saying (a
   healthy failure rate produces no line), and collapsing to one confirmation
   when everything is fine.

   **Honesty constraints baked in, don't undo them:**
   - The thresholds are **rules of thumb, and the card says so.** We have no
     benchmark dataset; inventing precise industry averages to lend them
     authority would be fabrication. The module doc records what each threshold
     *is* grounded in (undelivered ≈ bad numbers; Meta treats failures as a
     quality signal; WhatsApp read rates run high because messages land beside
     personal chats).
   - **Reply rate is deliberately unscored.** It depends entirely on whether the
     message asked for a reply, and we can't tell which did — scoring an
     order-confirmation blast against a conversational campaign would be noise
     dressed as insight.
   - On campaign detail, interpretation runs **only on backend-provided rates**,
     never the local `pct()` display fallback.

   `lib/benchmarks.test.ts` (17 cases) pins the boundaries (90/70, 60/40, 2/5),
   the inverted direction on failure rate, NaN handling, and that a healthy
   failure rate is toned `default` rather than `success`.

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
- ~~**Billing / wallet**~~ — **shipped (P0-GTM, §15):** prepaid wallet, top-up,
  statement, and 402-driven exhaustion recovery. Still open on top of it: usage
  metering with markup over Meta's per-conversation pricing, pre-broadcast cost
  estimates, and auto-recharge.

Near-term (was the backend deferred backlog; all three have since landed and are
wired): binary media upload — inbox drag-drop; click/CTR tracking — "clicked"
segment + CTR analytics; pending-invite team flow — email invites.

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

- **Whitelist validation (P1-MIGRATION, live):** the global `ValidationPipe` runs
  `whitelist + forbidNonWhitelisted`, so **any property a DTO does not declare is
  a 400, not a silent drop** (`["property userId should not exist"]`). The user
  comes from the session cookie on every route, so `userId` must never be sent —
  in a query, a body, or a path. `GET /auth/facebook-accounts` takes no path
  param; `GET /business/facebook` takes `accountId` only. Every `accountId` and
  `:id` must be a real UUID (a malformed one is now a clean 400 instead of a 500),
  and pagination is `limit` 1–200 (or 500 on contacts/recipients/enrollments/
  sessions), `offset` ≥ 0 — see the caps in the OpenAPI document, not in memory.
- **Live contract:** with the backend running, Swagger UI is at
  `http://localhost:3000/docs` and the machine-readable document at
  `/docs-json`. It is generated from the same DTO classes the server validates
  against, so it is the source of truth for names, types, and constraints —
  check it before adding a call, rather than inferring shapes from a response.
- **Billing is Razorpay-backed (P1-MIGRATION):** `POST /billing/credit` is
  **admin-only** (403 for a normal user) — it credits with no payment behind it.
  Customer top-ups are `POST /billing/topup/order` → Razorpay Checkout → a
  **server-side webhook** credits the wallet. The browser is never in the credit
  path, so Checkout's success callback means "the gateway accepted it", not "the
  balance moved" — confirm by re-reading `GET /billing/wallet`. `amount` in the
  order response is already in **minor units**; multiplying again charges 100x.
- **Sends are two-stage:** a 2xx from `/whatsapp/send*` returns
  `{ messageId, deliveryStatus: 'accepted', session }` — Meta *queued* it. The
  real outcome (delivered/read/failed) arrives later by webhook over the WS. A
  send response must never render a delivered checkmark.
- **24-hour window:** free-form sends outside it fail with a 400 carrying code
  **131047 / `outside_24h_window`** plus `lastInboundAt` / `expiresAt`. Branch on
  the code, never the message text. `GET /whatsapp/session-window?accountId=
  &phoneNumberId=&to=` returns `{ open, lastInboundAt, expiresAt }` so the
  composer can be gated *before* the user types.
- **402 will be switched on server-side without a frontend deploy** — the
  wallet-exhausted guard is off by default today. The handler must already exist.

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

2. **Meta access token is returned in API responses — OPEN, backend-owned.**
   Found 2026-08-20 against backend `188503d` while testing the flow canvas.
   `POST /flows` returns the created flow with the entire `Account` row
   embedded, including the plaintext long-lived `accessToken` (also
   `whatsappPin`, wallet balance, GSTIN, `facebookBusinessDetails`). The
   column *is* encrypted at rest, but the TypeORM transformer decrypts on
   read, so the plaintext goes out over the wire — the at-rest encryption is
   undone by the response shape.

   Whoever holds that token can send messages, read templates, and call Graph
   as the customer's business until it expires. It is reachable by anything
   with the session: an XSS on the dashboard, a browser extension, a devtools
   screenshot in a ticket, or a log that captures response bodies — none of
   which should be enough to take over a WhatsApp number.

   Root cause is structural, not one endpoint: `Account` carries no
   `@Exclude()` on the sensitive columns and no `ClassSerializerInterceptor`
   is registered, so any handler returning an entity with a loaded `account`
   relation leaks it. Verified on `flows.service#create`/`#update`; the same
   shape appears in `segments`, `campaigns`, and `drips` services. Treat that
   as a starting point, not a complete audit.

   Fix is two layers: `@Exclude()` on `accessToken`/`whatsappPin` plus a
   global `ClassSerializerInterceptor` as the backstop, **and** not returning
   the relation at all (a flow response has no reason to carry an account).
   Worth an e2e assertion that no response body in the suite contains an
   `accessToken` key, so the next endpoint of this shape fails in CI.

   Not blocking the frontend — nothing here reads `account` off these
   responses — but it shouldn't sit. Detail was in
   `backend-prompt-account-token-leak.md`, removed from the tree on
   2026-08-21; recover it from `bca5aa0` if the backend wants the full write-up.

**MEDIUM**
3. **Content-Security-Policy + security headers** — `next.config.mjs` sets no
   `headers()`. Add a `headers()` block (or `middleware.ts`) with
   `Content-Security-Policy`, `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   and HSTS. **No-break rollout:** ship CSP in **`Content-Security-Policy-Report-Only`**
   first, watch violation reports, tighten, then enforce. CSP is the strongest
   XSS mitigation and pairs with #1.
4. **Route middleware (`middleware.ts`)** — protected routes are guarded
   **client-side only** today (`typeof window` in `lib/auth.ts`); pages flash
   before redirect and there's no edge enforcement. Add `middleware.ts` to
   redirect unauthenticated requests at the edge. Backend JWT stays the real
   gate — this is defense-in-depth, so it can't break authorized flows.

**LOW**
5. **Remove mock secrets from client source — DONE.** The whole
   `app/dashboard/waba/` placeholder route (list + `[wabaId]` detail + loading)
   was deleted: it shipped a fake FB-token-shaped `apiKey` and webhook URLs in
   the bundle, nothing linked to it, and the live surface is
   `/dashboard/whatsapp`. Verified: no `EAABZ`-shaped strings in `.next/`.
6. **`rel="noopener noreferrer"` on every `target="_blank"`** (2–3 spots) —
   closes reverse-tabnabbing. Trivial, additive.
7. **Dependency audit in CI — DONE.** A `yarn audit --groups dependencies` step
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
