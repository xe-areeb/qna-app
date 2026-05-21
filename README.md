# EventPulse

> Live quiz engagement and audience rankings for events.

EventPulse is a public, **event-based** quiz leaderboard app: visitors enter a display name and complete a multiple-choice quiz **for a specific event**, then rank on a **per-event live leaderboard** (Convex). Includes a **projection** view at `/display` for external screens.

## Current assumptions (pending client confirmation)

The build is unblocked under these working assumptions - see [`project.md`](./project.md) for the full list and the open client questions.

- The app supports **multiple events**; each has its own questions and leaderboard.
- Visitors **do not sign up**; they enter a display name and the client persists a stable `visitorIdentifier`.
- **One response per visitor per event.**
- **Per-event analytics first**; cross-event aggregates can be layered later.
- Branding is **global** for now; per-event branding deferred.
- Admin tools are gated by an **MVP shared-secret** (`ADMIN_ACCESS_CODE` on the Convex deployment) - see "Admin gate (MVP)" below. Replace with Convex Auth + role check before deployment.

## Event-based model

| Concept | Where it lives |
|---------|----------------|
| Event | `events` table (`title`, `slug`, `status`, dates) |
| Questions | `questions` table (scoped by `eventId`) |
| Visitor attempt | `quizSessions` (scoped by `eventId` + `visitorIdentifier`) |
| Answer | `answers` (carries `eventId` for per-event analytics) |
| Leaderboard | `quizSessions.getLeaderboard({ eventId })` |
| Projection | `/display` (event scope to be wired via URL) |

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Convex** (database + server functions + real-time queries)
- **Cloudflare Pages** - frontend hosting via Next.js **static export** (no adapter required; see "Deployment" below)

## Prerequisites

- **Node.js** 20+
- **npm** (bundled with Node)

## Local setup

> **Quick checklist** - `npm install` → `npm run convex:dev` → copy URL into `.env.local` → `npm run dev`.

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. **Convex** - create/link a dev deployment (requires a [Convex](https://www.convex.dev/) account on first run):

   ```bash
   npm run convex:dev
   ```

   This prints a deployment URL. Copy it into your Next.js env (step 3).

3. Create **`.env.local`** in the project root:

   ```bash
   cp .env.example .env.local
   ```

   Set `NEXT_PUBLIC_CONVEX_URL` to the **HTTP Actions / deployment URL** shown by `convex dev` (typically `https://your-deployment.convex.cloud`).

4. Run the Next.js dev server (in a **second** terminal if `convex dev` is still running):

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Convenience

- **Convex only**: `npm run convex:dev` - watches Convex functions and regenerates types when codegen is enabled.
- **Codegen once** (requires `CONVEX_DEPLOYMENT` / configured project): `npm run convex:codegen`

## Environment variables

| Variable | Where it lives | Required | Description |
|----------|----------------|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (Next.js) | **Yes** for real data | Convex deployment URL from `npx convex dev` / Convex dashboard. Without it, the app uses a build-time placeholder URL and **skips** live queries (banner shown). |
| `NEXT_PUBLIC_DEMO_ACCESS_CODE` | `.env.local` + **Cloudflare Pages** | Recommended for shared demos | Temporary site-wide demo access code for `/`, `/leaderboard`, `/display`, `/admin`, `/admin/questions`, `/admin/analytics`, `/quiz`, and `/results`. Unlocked state is cached per tab in `sessionStorage`. Because this is a public static-export env var, it is demo privacy only, not production-grade security. |
| `CONVEX_DEPLOYMENT` | `.env.local` (Next.js) | For CLI / codegen | Set automatically when Convex CLI configures the project (see `.env.local` after `convex dev`). |
| `ADMIN_ACCESS_CODE` | **Convex deployment env vars** (set with `npx convex env set`) | **Yes** if you want to use the admin pages | Shared secret for the MVP admin gate. Read by `process.env.ADMIN_ACCESS_CODE` inside Convex functions. **Do not** prefix with `NEXT_PUBLIC_` - the value must stay server-side. See "Admin gate (MVP)" below. |

**Convex Auth** (future milestone) will replace the shared-code gate with proper per-user auth.

## Demo access gate

The public demo link has a temporary site-wide access screen branded **EventPulse Demo**. Visitors enter the `NEXT_PUBLIC_DEMO_ACCESS_CODE` once per browser tab; a successful unlock stores `qna:demo-access-unlocked` in `sessionStorage`. The header includes a small **Lock demo** action that clears this state.

This is separate from admin access:

- **Demo access code** (`NEXT_PUBLIC_DEMO_ACCESS_CODE`) opens the demo site in a browser tab.
- **Admin access code** (`ADMIN_ACCESS_CODE`) opens admin tools and is still verified server-side by Convex.

Because the app is a static export, `NEXT_PUBLIC_DEMO_ACCESS_CODE` is inlined into the frontend bundle. Treat it as light privacy for internal testing, not real authentication. If the variable is missing, local development stays open; production builds show a friendly configuration message on protected routes.

## Admin gate (MVP)

The admin pages (`/admin/questions`, `/admin/analytics`) and every dangerous Convex mutation/query are protected by a **single shared secret**. This is good enough for an MVP/client demo; it is **not** real auth (no per-user accounts, no role separation, no audit trail).

### How it works

1. Set the secret on the Convex deployment:

   ```bash
   npx convex env set ADMIN_ACCESS_CODE <your-code>
   ```

   Use one value for the dev deployment, another for production. Re-running the command rotates the code.

2. Visit `/admin` in the app and enter the code into the unlock form. The form calls `adminAuth.verifyAdminCode` server-side; on success the code is cached in this tab's `sessionStorage` (key `qna:admin-code`).

3. Once unlocked, `/admin/questions` and `/admin/analytics` render normally. The cached code is forwarded as the `adminCode` argument to:

   - `seedDemoEvent`, `resetDemoEventResponses`
   - `adminCreateEvent`, `adminUpdateEvent`, `adminArchiveEvent`
   - `adminCreateQuestion`, `adminUpdateQuestion`, `adminDeleteQuestion`
   - `getEventAnalytics`, `getQuestionAnalytics`

4. The Lock-admin button on `/admin` clears the cached code. Closing the tab also clears it (sessionStorage is per-tab).

### What this gate does NOT do

- It does **not** authenticate individual users. Every "admin" shares one code.
- It does **not** rate-limit guesses, lock out brute-force attempts, or write an audit trail.
- It does **not** protect public visitor endpoints - `submitAnswer`, `getLeaderboard`, `getQuizResult`, etc. stay anonymous so the quiz is playable without admin.
- It does **not** persist the code beyond the current browser tab.

Treat it as a "safe enough for a client demo" hatch and replace with Convex Auth + role checks before public deployment.

## Deployment

The app deploys as **two independent pieces**:

| Piece | Hosted on | Build command | Notes |
|------|-----------|---------------|-------|
| Convex backend (schema + functions) | Convex managed cloud | `npx convex deploy` | Stores `ADMIN_ACCESS_CODE` and serves all queries/mutations. |
| Next.js frontend (static export) | Cloudflare Pages | `npm run build` → `out/` | Pure static - no adapter, no Workers needed. |

### Why static export to Cloudflare Pages?

Every route in this app prerenders to static HTML (verified by `npm run build` - every route prints as `○ (Static)`). All data fetching happens client-side via the Convex React client. There are **no** server actions, route handlers, server-only fetches, or dynamic route params. That makes Cloudflare Pages with Next.js' built-in static export the simplest and most stable target - no `@opennextjs/cloudflare` / `next-on-pages` adapter required.

`next.config.ts` is set to `output: "export"` and `images.unoptimized: true`. Running `npm run build` produces `out/`, which is what Cloudflare Pages serves.

> If we ever introduce server actions, route handlers, ISR, or dynamic SSR, switch to `@opennextjs/cloudflare` and update this guide.

### Step 1 - Deploy Convex (backend)

From your local machine, with this repo checked out:

```bash
# One-time: link a production Convex deployment.
# (You can also do this in https://dashboard.convex.dev → New project.)
npx convex deploy

# Set the production admin code on the prod deployment.
npx convex env set ADMIN_ACCESS_CODE <your-prod-code> --prod
```

`npx convex deploy` pushes `convex/schema.ts` + every function in `convex/`. It prints the **production HTTP URL** (e.g. `https://your-app.convex.cloud`) - copy this; you'll paste it into Cloudflare Pages in the next step.

### Step 2 - Deploy the frontend to Cloudflare Pages

You can use either the Cloudflare dashboard (recommended) or `wrangler` CLI.

#### Option A: Connect Git repo via Cloudflare Pages dashboard

1. Push this repo to GitHub / GitLab.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick this repo and configure the build:

   | Setting | Value |
   |---------|-------|
   | Framework preset | **Next.js (Static HTML Export)** (or "None"/"Custom") |
   | Build command | `npm run build` |
   | Build output directory | `out` |
   | Node version | `20` (Settings → Environment variables → `NODE_VERSION=20`) |
   | Root directory | `/` |

4. Under **Environment variables** add (for both **Production** and **Preview**):

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_CONVEX_URL` | The production HTTP URL printed by `npx convex deploy`. |
   | `NEXT_PUBLIC_DEMO_ACCESS_CODE` | `your-demo-code` for the temporary demo access screen. |
   | `NODE_VERSION` | `20` |

5. Click **Save and Deploy**.

#### Option B: Manual upload via Wrangler CLI

```bash
npm install -g wrangler   # one-time
npm run build             # produces out/

# First-time only: create the Pages project
wrangler pages project create qna-frontend --production-branch main

# Deploy out/ to the project
wrangler pages deploy out --project-name qna-frontend
```

Then set the env var in the dashboard (Pages → your project → Settings → Environment variables) **before** the next build, since `NEXT_PUBLIC_*` values are inlined at build time.

### Required environment variables (summary)

| Where | Variable | Value |
|-------|----------|-------|
| **Cloudflare Pages** (Production + Preview) | `NEXT_PUBLIC_CONVEX_URL` | Production Convex URL from `npx convex deploy`. |
| **Cloudflare Pages** (Production + Preview) | `NEXT_PUBLIC_DEMO_ACCESS_CODE` | Temporary demo access code, for example `your-demo-code`. Public/inlined; demo privacy only. |
| **Cloudflare Pages** | `NODE_VERSION` | `20` |
| **Convex prod deployment** | `ADMIN_ACCESS_CODE` | The shared admin secret. Set with `npx convex env set ADMIN_ACCESS_CODE <code> --prod`. **Server-side only.** |

> `ADMIN_ACCESS_CODE` is **not** set in Cloudflare. The frontend never reads it directly - Convex functions read it via `process.env.ADMIN_ACCESS_CODE` and the client only ever holds the value the visitor types into `/admin`.

### Step 3 - Test the production deployment

After Cloudflare reports a successful deploy:

1. **Smoke test the visitor flow** at the production URL (`https://<project>.pages.dev`):
   - `/` loads, no yellow "Convex URL not configured" banner.
   - Enter a display name → take the quiz → land on `/results`.
   - `/leaderboard` shows your run.
   - `/display` shows the projection layout (no header/footer).
2. **Smoke test the admin gate**:
   - Open `/admin` → enter the prod `ADMIN_ACCESS_CODE` → unlock should succeed.
   - Open `/admin/questions` → the **Seed demo event** button should run successfully if you haven't seeded prod yet.
   - Open `/admin/analytics` → totals + per-question bars should populate.
   - Click **Reset responses** in either admin page → confirm → the leaderboard / `/display` go back to empty.
   - Click **Lock admin** on `/admin`; revisiting `/admin/questions` should show the access-required card.
3. **Verify wrong codes fail**: enter a wrong admin code → server should reject with "Invalid admin access code".
4. **Verify no leakage**: open browser devtools → Network tab → confirm `ADMIN_ACCESS_CODE` is **not** in any HTML / JS payload (only the value the user types is sent - and only as a Convex mutation arg).

### Rotating the admin code

Run `npx convex env set ADMIN_ACCESS_CODE <new-code> --prod` again. Existing browser tabs holding the old code will start failing on the next protected call; users should re-unlock at `/admin`.

### Local preview of the production export

To check the static export locally before pushing to Cloudflare:

```bash
npm run build       # produces out/
npm run preview     # serves out/ on http://localhost:4173 via npx serve
```

`npm run preview` uses `npx -y serve out -l 4173` so no extra dependency is committed.

> `npm start` / `next start` does **not** work with `output: "export"`. Use `npm run preview` instead for production-export QA.

## Demo safety

- The demo access gate is **privacy only**. `NEXT_PUBLIC_DEMO_ACCESS_CODE` is bundled into the static frontend and can be discovered by someone inspecting the site assets. Use it to keep an internal demo link out of casual view, not as production security.
- The admin gate is **MVP-only** (one shared `ADMIN_ACCESS_CODE`). Do **not** use this app in its current form for a real, public, multi-admin production deployment - replace with Convex Auth + role checks first.
- **Do not commit the admin code** to git, screenshots, support channels, or the Cloudflare repo metadata.
- **Do not paste the admin code into screen recordings or shared client demos** - anyone who sees it has full admin access until you rotate.
- The Convex `ADMIN_ACCESS_CODE` env var is server-side only; treat it like a database password.

## Project layout (high level)

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router routes (incl. `/admin` unlock, `/admin/questions`, `/admin/analytics`, projection-friendly `/display`) |
| `components/` | Shared UI (layout chrome, demo access gate, Convex provider, leaderboard panel, route error card, admin gate, placeholders) |
| `lib/` | Client-side utilities (e.g. `useDemoAccess` and `useAdminUnlock` sessionStorage hooks) |
| `convex/` | Schema + Convex functions (`events`, `questions`, `quizSessions`, `answers`, `analytics`, `seed`, `adminAuth`) |
| `convex/_generated/` | Auto-generated by `npx convex dev` - typed `api`, `Id<TableName>`, etc. Do not edit by hand. |

## Current implementation status

| Area | Status |
|------|--------|
| Routes & shell UI | Working pages for `/`, `/quiz`, `/results`, `/leaderboard`, `/display`, `/admin`, `/admin/questions`, `/admin/analytics`. `SiteChrome` hides the global header/footer on `/display` for the projection view. |
| Convex schema | `events`, `questions`, `quizSessions`, `answers` (event-scoped). |
| Convex API | `events`: list / by-slug / admin CRUD. `questions`: list (by event) + admin CRUD. `quizSessions`: `createQuizSession`, `completeQuizSession`, `getLeaderboard`, `getQuizResult`, `getSessionAnsweredCount`, `getSessionRank`. `answers`: `submitAnswer`. `analytics`: `getEventAnalytics`, `getQuestionAnalytics`. `seed`: `seedDemoEvent`, `resetDemoEventResponses`. `adminAuth`: `verifyAdminCode`, `isAdminConfigured` (+ `assertAdmin` helper). |
| Admin /questions page | Event picker, list (active only), create form, **inline edit per row** (Save / Cancel), hard delete, **Create demo event** button, **Reset responses** danger-zone. Wrapped in `AdminGate`. Reorder UI still TODO. |
| Admin /analytics page | Event picker, top-line stat cards (completed, in-progress, average score / percentage, highest score, fastest top-scorer time, active questions), per-question correctness bars, **Reset responses** danger-zone. Wrapped in `AdminGate`. Daily-trend chart is a clearly marked placeholder. |
| Seed data | `seed.seedDemoEvent` creates the `demo-event` event (title `EventPulse Demo`, `status: active`) and 15 sample questions; idempotent. On reuse, also patches `title` / `description` back to the constants in `convex/seed.ts` if they have drifted. Admin-gated. |
| Visitor flow | **Working & polished** - landing (instructions + validation) → quiz (large tap targets, percent progress, "Saving…" / "Completing quiz…" states) → results (rating-tinted card, formatted time, rank within event). |
| Direct route errors | `/quiz` and `/results` opened without their URL params show a polished `RouteError` card with a **Start from home** CTA. |
| Visitor auth | **Deferred** - display name + client `visitorIdentifier` (`${eventId}:${slug(name)}`). Same name + same event = shared attempt. |
| Demo access | Temporary public-link privacy gate via `NEXT_PUBLIC_DEMO_ACCESS_CODE`; unlocks per browser tab via `sessionStorage`. Public/inlined in the static bundle, so not production-grade security. |
| Admin auth | **MVP shared-code gate** - `ADMIN_ACCESS_CODE` env var on Convex, unlocked once at `/admin` per browser tab. Replace with Convex Auth + role check before deployment. |

See **`project.md`** and **`technical.md`** for the full product spec and technical contract.

## Seeding the demo event

After Convex is configured (`npm run convex:dev` + `NEXT_PUBLIC_CONVEX_URL` in `.env.local`):

1. Run the dev server (`npm run dev`).
2. Open [http://localhost:3000/admin](http://localhost:3000/admin), enter your `ADMIN_ACCESS_CODE` to unlock, then open [http://localhost:3000/admin/questions](http://localhost:3000/admin/questions).
3. Click **Create demo event** (labelled this way in the UI; backed by the idempotent `seed.seedDemoEvent` mutation). Re-running it never duplicates the event or its questions.

Alternatively, call `seed:seedDemoEvent` from the Convex dashboard (Functions → run with `{ adminCode: "<your-code>" }`).

## Visitor flow (end-to-end)

Once the demo event is seeded, you can play through the full loop:

1. **Landing `/`** loads the demo event by slug, shows a **How it works** card (question count, scoring visibility, one-attempt-per-name rule, no backtracking), and asks for a display name.
   - The display name input enforces a 2-character minimum and rejects names that are pure punctuation. The **Start quiz** button stays disabled while the input is invalid or while a request is in flight.
   - The same name + same event reuses the previous attempt - resume in-progress, or jump straight to results if completed.
2. **`/quiz?event=demo-event&sessionId=…`** shows one question at a time with a `Question N of M` progress bar (and percent-complete readout). Picking an option flips a clear emerald ring; the submit button cycles **Next question → Saving… → Submit final answer → Completing quiz…** to block double-submits. Score is **not** revealed mid-quiz; backtracking is disabled.
3. After the final answer, `completeQuizSession` runs and you're redirected to **`/results?sessionId=…`** with score, percentage, **rating** (Champion / Excellent / Good / Try Again), `Mm Ss`-formatted time, and a rank chip (e.g. `#3 of 12`) when the event already has completed runs. Buttons link to **View leaderboard**, **Open projection screen** (new tab), and **Back to home**.
4. **`/leaderboard`** and **`/display`** show real-time rankings for the demo event. The leaderboard adds rank chips, top-3 medals, and per-row percentage + rating; the display screen hides the site chrome, jumps to oversized typography, shows the top **5** in a fixed-height scoreboard layout (no scrolling), and includes a small **Exit projection** link.

### Direct-route behaviour

- Hitting `/quiz` without `?event=&sessionId=` shows a polished error card ("No quiz in progress") with a primary **Start from home** button and a secondary leaderboard link.
- Hitting `/results` without `?sessionId=` shows the same polished card pattern ("No result to show") with a **Start from home** primary CTA.

### Analytics (admin)

`/admin/analytics` is a basic per-event dashboard:

- Top-line stat cards: completed participants, in-progress sessions, average score, highest score, average percentage, fastest top-scorer time, active question count.
- Per-question correctness bars (`% correct` of all answers recorded for that question).
- A daily completion trend card is currently a clearly marked placeholder (see [`technical.md`](./technical.md)).

Both analytics queries are admin-gated (require the `adminCode` arg). The page itself is wrapped in `AdminGate` and only renders once the visitor has unlocked at `/admin`. Same shared-secret caveat as the rest of the admin surface - replace with Convex Auth + role check before public exposure.

### Reset demo responses (admin)

Both `/admin/analytics` and `/admin/questions` include a destructive red **Danger zone → Reset responses** button that wraps `seed.resetDemoEventResponses`:

- **Deletes**: every `quizSessions` row + every `answers` row scoped to the demo event.
- **Preserves**: the event itself (`demo-event`) and every question (active or inactive).
- **Confirm**: the button gates with a browser `confirm` dialog before running.
- **Effect**: analytics totals, the public leaderboard, and the projection screen all return to their empty states until a new visitor finishes the quiz. Nothing else has to be reseeded.

If the demo event hasn't been seeded yet, the call is a graceful no-op (it returns `{ deletedSessions: 0, deletedAnswers: 0, eventFound: false }` and shows a friendly inline message).

> The mutation is admin-gated (requires the unlocked `adminCode`), but the gate is the MVP shared secret - not real auth. Replace with Convex Auth + role checks before public deployment.

### Rating bands

| Percentage | Rating |
|------------|--------|
| 90–100 | Champion |
| 75–89 | Excellent |
| 50–74 | Good |
| <50 | Try Again |

### Visitor identifier (temporary)

`visitorIdentifier = ${eventId}:${slug(displayName)}` - the same name + same event collide. **OK for demo, not for a public competition.** Replace with Convex Auth before deploying.

## Remaining limitations (demo build)

- **Admin gate is MVP shared-secret only** - `ADMIN_ACCESS_CODE` is one value shared by every admin. No per-user accounts, no role separation, no rate limiting, no audit. Replace with Convex Auth + role check before deployment.
- **Demo access is not auth** - `NEXT_PUBLIC_DEMO_ACCESS_CODE` is client-visible by design because the app is a static export. It only discourages casual access to shared demo links.
- **Visitor identity is advisory** - `visitorIdentifier = ${eventId}:${slug(displayName)}`. Same name + same event collide. OK for demos, **not** public competitions.
- **No anti-cheat / rate limiting** on `submitAnswer` or `createQuizSession`.
- **Multi-event routing not wired yet** - `/`, `/leaderboard`, and `/display` always resolve the slug `demo-event`. Per-event URLs (`/event/[slug]/…`) are a future milestone.
- **Analytics aggregates run in-memory** per request - fine for demo volumes; should switch to denormalised counters or scheduled aggregations for larger events.
- **Cloudflare deploy uses static export.** The current setup works because every route prerenders. If we add server actions, route handlers, ISR, or dynamic SSR, switch to `@opennextjs/cloudflare`.

## Next required steps

1. `npm run convex:dev` (already wired) - keep this terminal running.
2. **Set the admin code** with `npx convex env set ADMIN_ACCESS_CODE <your-code>` (once per Convex deployment).
3. `npm run dev` - start the Next.js dev server in a second terminal.
4. Visit `/admin`, unlock with the code you set, then open `/admin/questions` and click **Seed demo event** if you haven't already.
5. Add admin **reorder** UI for questions (drag/drop or up/down - would call `adminUpdateQuestion({ order })` for the swapped rows). Edit-in-place is already shipped.
   - The visible UI was scrubbed of internal/developer notes (function names, "MVP gate", "TODO", `sessionStorage`, "Convex Auth", "Seed demo event" → "Create demo event", "Reset demo responses" → "Reset responses", etc.). The same notes still live in this README, `project.md`, and `technical.md` for the team.
6. Switch `adminDeleteQuestion` callers to a **soft archive** (flip `isActive`) before any production exposure.
7. Make `getLeaderboard.eventId` required once an event picker reaches `/leaderboard`.
8. Integrate Convex Auth and replace the shared-code admin gate with role-based per-user access.

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Dev | `npm run dev` | Next.js dev server on `http://localhost:3000`. |
| Build | `npm run build` | Static export → `out/`. What Cloudflare Pages runs. |
| Preview | `npm run preview` | Serve `out/` on `http://localhost:4173` via `npx -y serve`. Use for local QA of the production export. |
| Lint | `npm run lint` | ESLint over the whole repo. |
| Convex dev | `npm run convex:dev` | Watches Convex functions and regenerates types. |
| Convex codegen | `npm run convex:codegen` | One-shot codegen. |
| Convex deploy | `npm run convex:deploy` | Pushes schema + functions to the linked Convex production deployment. |

> `npm start` / `next start` does **not** work with `output: "export"`. Use `npm run preview` for local production QA.
