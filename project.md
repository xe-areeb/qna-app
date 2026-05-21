# EventPulse - Project Overview

> Live quiz engagement and audience rankings for events.

## Purpose

EventPulse is a public, event-based quiz leaderboard app: visitors complete a multiple-choice quiz **for a specific event**, then rank against others on a **per-event live leaderboard**. A projection-friendly display shows event rankings on a large screen.

## Event-based Product Direction

The product is moving from a single global quiz to a **multi-event** model:

- One app instance can host **many events** (each with its own slug, status, and lifecycle).
- Each event has its **own questions**, its **own quiz sessions**, and its **own leaderboard**.
- Analytics start **per event**; cross-event aggregations can be layered later.
- Branding is **global for now**; per-event branding can be added once the model is validated.

This direction is implemented as an **incremental extension** of the existing scaffold - routes, components, and Convex functions are kept; the schema gains an `events` table and existing tables gain an `eventId`.

## Temporary Assumptions Pending Client Confirmation

These assumptions unblock development while client questions are open. They may change without rebuilds - the schema is event-scoped from day one to absorb the answers cheaply.

1. The app supports **multiple events**.
2. Each event has its **own questions**.
3. Each event has its **own leaderboard**.
4. **Analytics are per event** initially; cross-event analytics come later via aggregation.
5. Visitors **do not need full sign-up** in v1.
6. Visitors enter a **display name** (`visitorName`) and the client persists a stable `visitorIdentifier`.
7. **One response per visitor per event** (enforced via a `by_event_visitor` index).
8. Admin users will eventually manage **events and questions**; admin auth is **deferred**.
9. Branding is **global** for now; per-event branding is a later enhancement.
10. Questions can **differ from event to event**.

## Client Questions (open)

- Do we need an **admin account** to set up users, events, and questions per event?
- Should question analytics apply only **per event**, or do they also need **overall analytics across all events**?
- Do visitors need to **sign up**, or just provide their **name on submission**?
- Can one visitor submit **only one response per event**?
- Is **branding the same across all events**, or should branding be **configurable per event**?
- Are questions **static across all events**, or **different per event**?
- What **analytics and dashboard metrics** are required?

## Target Users

- **Visitors**: Provide a display name and complete an event's quiz; view personal results and the event leaderboard.
- **Organizers / admins**: Manage events and per-event question banks (CRUD + reorder).
- **Audience (projection)**: View `/display` on a large screen with oversized typography for the active event.

## Core Product Rules

| Rule | Behavior |
|------|----------|
| Question flow | One question at a time; **4 options** per question. |
| Scoring visibility | **No score or rating until all questions are answered.** |
| Back navigation | **Disabled by default**; only allowed if explicitly enabled. |
| Submissions | **One completed quiz session per visitor per event.** |
| Leaderboard sort | **Highest score first**, then **fastest completion time** as tiebreaker. |
| Question count | Default target is 15 per event; schema stores `totalQuestions` for flexibility. |

## Features (Product Checklist)

- [x] Visitor display name capture (`visitorName`) on the landing page, with up-front instructions, 2–40 character validation, and disabled-while-loading state.
- [x] Quiz UI with progress: `Question X of N`, a progress bar, percent-complete readout, accessible `role="progressbar"`, lettered options, mobile-friendly tap targets.
- [x] Persist **each answer** to Convex as the visitor progresses (server-side `isCorrect` computed but **never** displayed mid-quiz).
- [x] "Saving…" / "Completing quiz…" UI states; double-click and concurrent submission are guarded.
- [x] Result calculation after final question: score, total questions, percentage, rating, time taken.
- [x] Persist **completed quiz session** (final aggregates + timing) per event.
- [x] Results screen after completion - celebratory rating-tinted card, `Mm Ss` time formatting, **rank within event** (#X of N) where computable, and CTAs for leaderboard / projection / home.
- [x] **Real-time** per-event public leaderboard (Convex live queries) - rank chips, top-3 medals, percentage + rating per row, `/leaderboard` resolves `demo-event` and feeds `LeaderboardPanel`.
- [x] Full-screen `/display` route for projection - site chrome hidden, **fixed scoreboard layout** (`h-dvh` + `overflow-hidden`, never scrolls), top 5 rows, oversized typography, high contrast, "Exit projection" escape hatch, live updates.
- [x] Polished error states for direct hits to `/quiz` and `/results` (no params) with a clear "Start from home" CTA via shared `RouteError` component.
- [x] Per-event analytics dashboard at `/admin/analytics` (totals + per-question correctness bars).
- [x] **Reset responses** danger-zone action on `/admin/analytics` and `/admin/questions` - deletes every visitor session + answer for the selected event while preserving the event and its questions. Wraps the `seed.resetDemoEventResponses` mutation with a browser `confirm`. Visible UI no longer mentions internal function names or implementation details.
- [x] **MVP admin gate** at `/admin` - single shared `ADMIN_ACCESS_CODE` (Convex env var) checked server-side. Unlocked code is cached in `sessionStorage` and forwarded to every protected mutation + analytics query. UI routes (`/admin/questions`, `/admin/analytics`) are wrapped in `AdminGate`; locked visitors see an "Admin access required" card with a CTA to `/admin`.
- [x] **Temporary demo access gate** - protected demo routes (`/`, `/leaderboard`, `/display`, `/admin`, `/admin/questions`, `/admin/analytics`, `/quiz`, `/results`) show an **EventPulse Demo** access screen before rendering app content. `NEXT_PUBLIC_DEMO_ACCESS_CODE` unlocks the current browser tab via `sessionStorage`; the header exposes a small **Lock demo** action. This is only privacy for internal testing because the app is a static export and the code is bundled client-side.
- [ ] Admin CRUD for **events** (Convex mutations exist; UI not built yet - only the seed flow creates events from the UI).
- [x] Admin CRUD for **questions** (per event) - list (active only), create, **edit in place** (`adminUpdateQuestion`), hard-delete. *Reorder UI is still TODO.*
- [x] Seed sample event + questions (`seedDemoEvent` mutation + admin **Create demo event** button in the UI; demo event slug `demo-event`).
- [x] **Client-facing UI cleanup pass** - branding standardised on **EventPulse** with the tagline "Live quiz engagement and audience rankings for events." across header, footer, metadata, landing, and display. All visible references to internal stack names, function names, `MVP gate`, `TODO`, `Convex Auth`, `sessionStorage`, "hard delete", and local-development hints have been replaced with audience-friendly copy. The same notes are preserved in this doc, `technical.md`, and `README.md` for the team.
- [ ] Visitor auth (deferred - display name only for v1).
- [x] **MVP admin gate** in place (shared `ADMIN_ACCESS_CODE` on Convex; `/admin` unlock; `AdminGate` wrapper). Per-user role-based admin auth (Convex Auth) still deferred.
- [x] **Cloudflare deployment ready** - Next.js static export (`output: "export"`) → Cloudflare Pages with `out/` as the build output directory. No adapter required for the current feature set.

## Scaffolding (completed steps)

- [x] **Next.js** App Router + **TypeScript** + Tailwind CSS v4.
- [x] **Routes**: `/`, `/quiz`, `/results`, `/leaderboard`, `/display`, `/admin/questions` - visitor flow + admin/questions are functional; placeholders are gone.
- [x] **Convex** project layout: `convex.json`, `convex/schema.ts`, `convex/events.ts`, `convex/questions.ts`, `convex/quizSessions.ts`, `convex/answers.ts`, `convex/seed.ts`.
- [x] **Convex client** in React (`ConvexClientProvider`, `NEXT_PUBLIC_CONVEX_URL` + fallback for SSR/build).
- [x] **Shared UI**: `SiteHeader`, `PageShell`, `LoadingPlaceholder`, `ErrorPlaceholder`, `LeaderboardPanel` (event-aware).
- [x] **README** + **`.env.example`** with local setup and deployment targets.
- [x] **Client API**: auto-generated by `npx convex dev` in `convex/_generated/`. Front-end imports `api` and `Id<TableName>` from there.
- [x] **Event-scoped schema**: `events` table added; `questions`, `quizSessions`, `answers` updated with `eventId` and per-event indexes.
- [x] **Visitor flow** - landing → quiz → results, with `submitAnswer` persistence, `completeQuizSession` scoring (rating bands: Champion/Excellent/Good/Try Again), session resume, and duplicate-attempt handling.

## Routes

| Path | Role |
|------|------|
| `/` | Landing - loads active demo event by slug, **tablet-kiosk activation screen** (two-column on `md+`: oversized **"Take the Quiz"** headline + supporting line + 3 rule chips (`15 questions`, `Score at the end`, `One attempt per name`) on the left; large name input + dominant **"Take Quiz Now"** primary button + secondary **View leaderboard** on the right). Brand/event shown as small pills. Stacks on mobile. Footer hidden so the kiosk fills the available height. Calls `createQuizSession` and routes to `/quiz` or `/results`. |
| `/quiz` | Per-question flow (one question at a time, slim progress bar, score hidden, no backtracking, resume-aware). **Tablet/kiosk-first layout**: header + question card fit a typical viewport without scrolling, the action button (`Next question` / `Submit final answer`) lives inside the card directly under the options. Footer is hidden on `/quiz`. Direct hits without `event` + `sessionId` show a polished `RouteError` with a **Start from home** CTA. |
| `/results` | Celebratory result card (score, percentage, rating, time taken, rank within event when computable) + leaderboard / projection / home CTAs. Direct hits without `sessionId` show a polished `RouteError`. |
| `/leaderboard` | Per-event live ranking (resolves `demo-event` → eventId). Top-3 medals, rank chips, percentage + rating per row. |
| `/display` | External projection screen for the demo event's leaderboard - site chrome hidden, **fixed-height layout that never scrolls** (`h-dvh` + `overflow-hidden`), top 5 rows distributed across the available height, oversized typography, high contrast, "Exit projection" link. |
| `/admin` | Admin entry point - unlock form when locked (verifies `ADMIN_ACCESS_CODE` server-side), or admin sub-nav (Questions, Analytics) + Lock-admin button when unlocked. |
| `/admin/questions` | Question management (gated) - event picker, list (active only), create form, **inline edit per row** (Save / Cancel), hard delete, **Create demo event** button (UI label; backed by `seed.seedDemoEvent`), **Reset responses** danger-zone. Only one row can be in edit mode at a time; other rows' Edit/Delete buttons are disabled while editing. |
| `/admin/analytics` | Per-event analytics (gated) - totals (completed, in-progress, average score / percentage, highest score, fastest top-scorer time, active questions) + per-question correctness bars + **Reset responses** danger-zone. |

All routes listed above are currently behind the temporary demo access gate for shared-link testing. The admin pages still require the separate Convex-backed admin code after demo access is unlocked.

## Deployment Targets

| Layer | Platform | Build path |
|-------|----------|------------|
| Frontend | **Cloudflare Pages** (static hosting) | `npm run build` → `out/` (Next.js `output: "export"`) |
| Backend & DB | **Convex** (hosted) | `npx convex deploy` |

> No `@opennextjs/cloudflare` / `next-on-pages` adapter is needed today: every route prerenders to static HTML and all data fetching is client-side via the Convex React client. If we add server actions / route handlers / ISR / dynamic SSR, switch to `@opennextjs/cloudflare`.

## Deployment Checklist

Run through this **in order** for a fresh production launch (or any time you change Convex schema / functions / admin code).

### 1. Convex (backend)

- [ ] `npx convex deploy` - pushes schema + functions to the production Convex deployment. Note the printed HTTPS URL.
- [ ] `npx convex env set ADMIN_ACCESS_CODE <prod-code> --prod` - sets the prod admin secret. Use a value distinct from dev.
- [ ] (Optional) `npx convex env list --prod` - sanity check.
- [ ] Verify in the Convex dashboard that the latest functions are listed.

### 2. Cloudflare Pages (frontend)

- [ ] Cloudflare → Workers & Pages → Pages project connected to the repo (or `wrangler pages deploy out`).
- [ ] Build command: `npm run build`. Output directory: `out`. Root: `/`.
- [ ] Environment variables (Production **and** Preview):
  - [ ] `NEXT_PUBLIC_CONVEX_URL` = production Convex HTTPS URL from step 1.
  - [ ] `NEXT_PUBLIC_DEMO_ACCESS_CODE=your-demo-code` = temporary demo access code for shared-link privacy.
  - [ ] `NODE_VERSION` = `20`.
- [ ] Trigger a deploy. Confirm Cloudflare's build log ends with the same "Generating static pages" output as `npm run build` locally.

### 3. Smoke test (production URL)

- [ ] Visitor flow: `/` → name → take quiz → `/results` shows score + rating + time + rank.
- [ ] `/leaderboard` lists your run; `/display` shows the projection layout (no header/footer).
- [ ] Admin unlock: `/admin` accepts the prod code and redirects/links to admin pages.
- [ ] `/admin/questions`: **Seed demo event** runs successfully on prod (idempotent).
- [ ] `/admin/analytics`: totals + per-question bars populate.
- [ ] **Reset responses** danger-zone: `/admin/analytics` (or `/admin/questions`) → confirm → leaderboard / display reset to empty.
- [ ] **Negative test**: enter a wrong admin code on `/admin` → server rejects with "Invalid admin access code".
- [ ] **Negative test**: open `/admin/questions` in a fresh tab without unlocking → `AdminGate` shows the access-required card.
- [ ] **Leak check**: devtools → confirm `ADMIN_ACCESS_CODE` is not in any HTML/JS payload (only the user-typed value travels as a Convex mutation arg).
- [ ] No yellow "Convex URL not configured" banner anywhere.

### 4. Required environment variables (recap)

| Where | Variable | Purpose |
|-------|----------|---------|
| Cloudflare Pages (Production + Preview) | `NEXT_PUBLIC_CONVEX_URL` | Production Convex HTTPS URL. Inlined at build time. |
| Cloudflare Pages (Production + Preview) | `NEXT_PUBLIC_DEMO_ACCESS_CODE` | Temporary demo access code. Inlined into the static frontend, so privacy only. |
| Cloudflare Pages | `NODE_VERSION` | `20`, so Next.js 16 builds successfully. |
| Convex prod deployment | `ADMIN_ACCESS_CODE` | Shared admin secret. **Server-side only - never expose to the client.** |

## Non-Goals (Initial Scope)

- Payments, teams, or private leaderboards.
- Per-event branding (global branding for v1).
- Cross-event aggregate analytics in v1 (per-event only initially).

## Visitor Flow (implemented)

1. **Landing `/`** loads the active event with slug `demo-event` and shows a **tablet-kiosk activation screen** that fills the available viewport (footer hidden on `/`). Left column: small **EventPulse** + event-title pills, oversized **"Take the Quiz"** headline, the line *"Answer 15 questions and see where you rank."*, and three rule chips (`15 questions`, `Score at the end`, `One attempt per name`). Right column: an oversized name input and a dominant **"Take Quiz Now"** button, with a secondary **View leaderboard** link. On mobile the card stacks vertically and scrolls.
2. The page builds a deterministic `visitorIdentifier = ${eventId}:${slug(name)}` (lowercased, hyphenated, alphanumeric only).
3. `createQuizSession({ eventId, visitorName, visitorIdentifier })` is called:
   - **No prior session** → new `in_progress` session is inserted.
   - **In-progress** session for this `(eventId, visitorIdentifier)` → resume.
   - **Completed** session → frontend redirects to `/results`.
4. `/quiz` shows one question at a time with progress (`Question N of M`), four radio options, no scoring info. Each click on **Next question / Submit final answer** calls `submitAnswer`. Backtracking is disabled.
5. After the final answer, `completeQuizSession` runs (or, on resume mid-finalize, an effect catches the all-answered state and finalizes), then routes to `/results`.
6. `/results` reads `getQuizResult({ sessionId })` and displays score, percentage, rating, and time taken.

### Rating bands

| % | Rating |
|---|--------|
| 90–100 | Champion |
| 75–89 | Excellent |
| 50–74 | Good |
| <50 | Try Again |

### Visitor identity (temporary)

Two visitors who type the **same name** on the **same event** collide and share an attempt - fine for the demo, **not** for a real competition. Replace with Convex Auth before public deployment.

## Open TODOs (next steps)

- **Question reorder** UI + drag/drop (or simple up/down) - would call `adminUpdateQuestion({ order })` for the swapped rows.
- **Soft archive on delete**: replace hard delete with `isActive=false` so historical answers/sessions survive.
- **Admin "list all questions" query** so inactive questions show in the admin list (currently `listActiveQuestions` filters them out).
- **Events admin UI** for full event CRUD (today only seeding creates events).
- **Visitor auth** - still deferred; replace `${eventId}:${slug(name)}` collision-prone identifier.
- **Per-user admin auth** - replace the MVP shared-code gate with Convex Auth + role checks (multi-admin, revocable, audited).
- **Cross-event analytics** (the dashboard is per-event today).
- **Daily completion trend chart** (placeholder card on `/admin/analytics`).
- **`@opennextjs/cloudflare` migration**, *only if* we add server actions / route handlers / ISR / dynamic SSR. Static export covers the current feature set.

## Known Limitations

- **No anti-cheat / rate limiting** on `submitAnswer` or `createQuizSession`. The same machine can spam visitor names to get multiple attempts.
- **MVP admin gate, not real auth**: `/admin/questions`, `/admin/analytics`, and every protected Convex mutation/query are gated by a single shared `ADMIN_ACCESS_CODE`. The code lives in Convex env vars (server-side); the UI caches it in `sessionStorage` after a one-time unlock at `/admin`. There are no per-user accounts, role separation, or audit trail. Replace with Convex Auth + role checks before public deployment.
- **Demo access gate is privacy only**: `NEXT_PUBLIC_DEMO_ACCESS_CODE` opens the public demo routes before the admin gate is reached. It is a public static-export variable and can be found in the browser bundle, so it must not be treated as production security.
- `getLeaderboard.eventId` remains optional for back-compat; will be required once an event picker reaches the leaderboard page.
- `listActiveQuestions` is the only question listing query - admin can't see inactive questions yet.
- Analytics aggregates are computed in-memory per request (small-event safe). Larger events should switch to denormalised counters or scheduled aggregations.
- `/display` cannot be used multi-tenant yet - it always loads the `demo-event` slug. Multi-event routing for the projection view is a later milestone.

## Related Documents

- **Technical architecture & schema**: [`technical.md`](./technical.md)
- **Environment setup**: [`README.md`](./README.md), [`technical.md`](./technical.md)
- **Doc sync for agents**: [`.cursor/rules/documentation-sync.mdc`](./.cursor/rules/documentation-sync.mdc)

---

*This file must stay aligned with the codebase. Agents update it whenever behavior, routes, or features change.*
