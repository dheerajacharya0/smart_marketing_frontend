# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: **yarn** (canonical — `yarn.lock` is the only lockfile).

- `yarn dev` — dev server (Next.js)
- `yarn build` — production build
- `yarn lint` — next lint
- `yarn typecheck` — `tsc --noEmit`
- `yarn test` / `yarn test:watch` — vitest (`vitest.config.mts`)
- `yarn test:e2e` — playwright (`playwright.config.ts`, specs in `tests/e2e/`)

Tests exist and are colocated: `lib/*.test.ts` (16 files) plus `components/phone-number-input.test.tsx`. Add a test next to the module it covers.

`next.config.mjs` sets `eslint.ignoreDuringBuilds: false` and `typescript.ignoreBuildErrors: false` — type and lint errors **fail the build**. `.github/workflows/ci.yml` is blocking on push/PR to `main`: typecheck, lint, unit tests, `yarn audit` (fails on high/critical only), then build. `yarn build` runs with `NODE_ENV=production`, where `lib/env.ts` requires a valid `NEXT_PUBLIC_API_BASE_URL`.

Also in `next.config.mjs`: security headers, with CSP shipped as `Content-Security-Policy-Report-Only` (not enforced yet). If you add a third-party script, iframe, or origin, update the CSP directives there or it will break when the header is switched to enforcing.

## Environment

`lib/env.ts` validates `NEXT_PUBLIC_*` config with zod at module load, and everything else reads config through it (`config/api-config.ts` imports `env`). `.env.example` is the tracked template; copy to `.env.local`. Dev has fallbacks (API base defaults to `http://localhost:3000`), production does not. NEXT_PUBLIC vars must be referenced by literal name so Next can inline them — never through a computed key.

## Architecture

Next.js 15 App Router (react 19), shadcn/ui (`components/ui`, vendored — compose over hand-editing), Tailwind, TanStack Query, `@/*` path alias to repo root.

**Auth**: the real credential is an httpOnly `access_token` cookie set by the **backend** origin (cross-origin API), so the frontend can never read it — API calls authenticate with `credentials: "include"`, not an `Authorization: Bearer` header. Don't add one.

Three layers, none of which is the real gate:
- `middleware.ts` — edge guard on `/dashboard/:path*`, gates on the `userData` UI session marker cookie (the JWT is invisible to it) and redirects to `/login?redirect=...`.
- `lib/auth.ts` — `requireAuth()` only (there is no `requireSuperAdmin`), a client-side `window.location.href` redirect.
- `app/dashboard/layout.tsx` — holds render until `requireAuth()` passes, so no flash of dashboard content.

The backend JWT is the actual gate; a stale marker just yields a 401 from the API layer. `services/api.ts` reads `userData` from a `js-cookie` cookie with a `localStorage` fallback (`signup()` writes only localStorage) — check which a given function uses.

**API layer**: `config/api-config.ts` holds ~20 endpoint-URL builder groups against `API_BASE_URL` (`AUTH_`, `BILLING_`, `WHATSAPP_`, `CHAT_`, `CONTACTS_`, `CAMPAIGNS_`, `SEGMENTS_`, `DRIPS_`, `FLOWS_`, `WHATSAPP_FLOWS_`, `ANALYTICS_`, `AUTOMATION_`, `TEAM_`, `API_KEYS_`, `ALERTS_`, `LINKS_`, `CONVERSIONS_`, `FACEBOOK_` …) plus `CHAT_WS_URL(accountId)`. `services/api.ts` (~3.4k lines) is the single typed client and the source of truth for domain types — no mock model layer, don't reintroduce one.

**Data fetching**: `hooks/use-queries.ts` holds typed TanStack Query hooks wrapping `services/api.ts`, keyed by resource + account; `components/query-provider.tsx` mounts the client in `app/layout.tsx`. Pages still hand-rolling `useState + fetch` are the migration target — add a hook there rather than fetching in a component. Realtime chat: `hooks/use-chat-socket.ts` / `use-chat-messages.ts`.

**Dashboard routing**: `app/dashboard/` is the authenticated area. Routes cover chat, contacts, campaigns, segments, drips, flows, whatsapp-flows, templates, billing, revenue, api-usage, automation, notifications, users, settings (+ `pricing`, `team`), docs, glossary, support, profile.

WhatsApp onboarding is a 4-step route group: `app/dashboard/whatsapp/[wabaId]/(onboarding)/step-1…step-4/page.tsx` under a shared `(onboarding)/layout.tsx`. `components/whatsapp-integration-stepper.tsx` derives the current step by parsing `usePathname()`; if you add/reorder/remove a step, update the `steps` array there to match.

**Facebook/Meta**: `lib/facebook-sdk.ts` loads the JS SDK for Embedded Signup (needs `NEXT_PUBLIC_FACEBOOK_APP_ID` + `NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID`). `components/connect-whatsapp-button.tsx` starts the flow; `components/facebook-code-handler.tsx` exchanges the code, wrapped by `facebook-code-handler-wrapper.tsx` for the `useSearchParams()` Suspense boundary. Entry point is `app/dashboard/whatsapp/new/page.tsx`. Any `useSearchParams()` needs a Suspense boundary or the production build crashes.

**Layout**: `components/unified-sidebar.tsx` + `components/layout/top-bar.tsx`, composed by `app/dashboard/layout.tsx` alongside `CommandPaletteProvider`, `WalletExhaustedProvider`, and `LowBalanceBanner`. `/dashboard/chat` renders full-bleed (own scroll regions).

**Observability**: `lib/observability.ts` — `reportError` no-ops unless `NEXT_PUBLIC_SENTRY_DSN` is set; `@sentry/nextjs` is not installed yet.
