# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` / `yarn dev` — run dev server (Next.js)
- `pnpm build` / `yarn build` — production build
- `pnpm lint` / `yarn lint` — next lint
- No test runner is configured (no jest/vitest/playwright in package.json) — do not assume tests exist.
- Package manager: **yarn** (canonical — `yarn.lock`). The empty `pnpm-lock.yaml` stub was removed in Phase 0. Use `yarn` for installs.

Note: `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` — production builds will succeed even with type errors or lint failures, so don't rely on `build` passing as a correctness signal.

## Architecture

Next.js 15 App Router project (react 19), shadcn/ui (`components/ui`, 50+ generated primitives — treat as vendored, prefer composing over hand-editing), Tailwind, `@/*` path alias to repo root.

**Auth**: `services/api.ts` holds all backend calls and is the source of truth for auth state. Token + user data are stored in both a `js-cookie` cookie (`authToken`, `userData`) and `localStorage`, inconsistently across functions (some read/write cookies, some localStorage) — check which one a given function actually uses before relying on it. `lib/auth.ts` wraps `isAuthenticated()`/`getCurrentUser()` from services/api into `requireAuth()` / `requireSuperAdmin()` route guards that redirect via `window.location.href` (client-side only, checks `typeof window !== "undefined"`).

**API config**: `config/api-config.ts` centralizes endpoint URL builders (`AUTH_ENDPOINTS`, `USER_ENDPOINTS`, `ADMIN_ENDPOINTS`, `FACEBOOK_ENDPOINTS`) against `API_BASE_URL`. Some endpoint groups referenced elsewhere (e.g. `WHATSAPP_ENDPOINTS` in `services/api.ts`) may not be defined here yet — verify an endpoint group exists in this file before assuming the import resolves.

**Domain models**: the old `lib/*-model.ts` mock data layers (`business-model.ts`, `user-model.ts`) and `lib/subscription-plans.ts` are **gone** — they were in-memory demo arrays with CRUD-shaped helpers, not persistence, and their last consumer (the mock `/dashboard/subscription` page) was deleted with them. Real types live with the API layer in `services/api.ts`; don't reintroduce a parallel mock model layer.

**Dashboard routing**: `app/dashboard/` is the authenticated area (`app/dashboard/layout.tsx`). Multi-step onboarding flows are modeled as Next.js route segments per step, e.g. `app/dashboard/whatsapp/[wabaId]/step-1 … step-8/page.tsx`, each a separate page under a shared `[wabaId]/layout.tsx`. `components/whatsapp-integration-stepper.tsx` renders the step indicator by parsing the current step number out of `usePathname()` — if you add/reorder/remove a step route, update the `steps` array in that component to match.

A parallel `app/dashboard/business/[businessId]/step-1…step-11` onboarding flow (plus `details/`, `new/`, list `page.tsx`) existed for business onboarding but has been removed from the working tree — when working in this area, check `git status`/`git log` first to see whether business flow removal is intentional in-progress work rather than assuming it's still present.

**Facebook/Meta integration**: WhatsApp step-2 (`app/dashboard/whatsapp/[wabaId]/step-2/`) handles the Meta/Facebook OAuth code exchange via `FacebookCodeHandler.tsx` (client component) wrapped by `FacebookCodeHandlerWrapper.tsx` (likely a Suspense/boundary wrapper for `useSearchParams()`). Related backend calls: `getFacebookLoginUrl`, `handleFacebookCallback`, `getFacebookAccounts`, `getFacebookBusinessManagers`, `setWhatsappBusinessDetails`, `getWhatsappBusinessAccount` in `services/api.ts`.

**Layout components**: `components/layout/app-sidebar.tsx` and `main-layout.tsx` provide the dashboard chrome; `app/dashboard/layout.tsx` composes them.
