# Admin gate (MVP) — flow

Snapshot of how the shared-code admin gate is wired between Convex and the
Next.js client. See `README.md` → "Admin gate (MVP)" for setup and
`technical.md` → "Admin gate (MVP)" for the implementation notes.

```
                            ADMIN_ACCESS_CODE  (Convex env var)
                                         │
                       npx convex env set │   ┌─────────────────────┐
                                         ▼   │  process.env.…       │
                  ┌──────────────────────────┴──────────────────────┐
                  │           Convex deployment                     │
                  │                                                 │
                  │  adminAuth.ts → assertAdmin(adminCode)          │
                  │  is called by:                                  │
                  │    seed.* / events.admin* / questions.admin*    │
                  │    analytics.getEventAnalytics                  │
                  │    analytics.getQuestionAnalytics               │
                  │  → throws ConvexError on missing/wrong code     │
                  └─────────────────────────────────────────────────┘
                                         ▲
                  adminCode arg          │
                  on every protected call│
┌──────────────────────────────────────────────────────────────────┐
│  Next.js client                                                  │
│                                                                  │
│  /admin (page) ── unlock form ── verifyAdminCode mutation        │
│        │                                                         │
│        └─→ useAdminUnlock.unlock(code) ── sessionStorage         │
│                              │                                   │
│  /admin/questions ── AdminGate ── unlocked? ── render with code  │
│  /admin/analytics ── AdminGate ── unlocked? ── render with code  │
│  ResetDemoButton ── adminCode prop ── mutation with code         │
└──────────────────────────────────────────────────────────────────┘
```

## Notes

- Public visitor endpoints (`createQuizSession`, `submitAnswer`,
  `completeQuizSession`, `getQuizResult`, `getSessionRank`,
  `getLeaderboard`, `listActiveQuestions`, `getActiveEventBySlug`,
  `listEvents`, `getSessionAnsweredCount`) are deliberately **not** gated —
  the quiz must be playable without admin.
- `ADMIN_ACCESS_CODE` lives only on the Convex deployment. The client
  never sees it via `NEXT_PUBLIC_*` — it only ever holds the value the
  user typed into `/admin`, cached per-tab in `sessionStorage`.
- This is a single shared secret, not real auth. Replace with Convex
  Auth + role checks before public deployment.
