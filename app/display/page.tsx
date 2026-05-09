"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LeaderboardPanel } from "@/components/leaderboard-panel";

const DEMO_EVENT_SLUG = "demo-event";
const DISPLAY_LIMIT = 10;

/**
 * External projection screen. The site chrome (header / footer / Convex
 * banner) is intentionally hidden here via `SiteChrome` so the leaderboard
 * fills the screen. High-contrast dark canvas, oversized type, top 10 rows.
 *
 * Live updates flow through `useQuery` in `LeaderboardPanel`, so finishers
 * appear without a refresh.
 */
export default function DisplayPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const event = useQuery(
    api.events.getActiveEventBySlug,
    hasUrl ? { slug: DEMO_EVENT_SLUG } : "skip",
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 px-6 py-8 text-white md:px-10 md:py-12">
      <Link
        href="/leaderboard"
        className="absolute right-4 top-4 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-white md:right-6 md:top-6"
      >
        Exit projection
      </Link>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 md:gap-12">
        <header className="text-center">
          <p className="text-base font-medium uppercase tracking-[0.4em] text-emerald-400/90 md:text-xl">
            Live leaderboard
          </p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight md:text-7xl">
            {event && event !== null ? event.title : "EventPulse"}
          </h1>
          {event && event !== null ? (
            <p className="mt-4 text-lg text-zinc-400 md:text-2xl">
              Top {DISPLAY_LIMIT} · highest score first, then fastest time
            </p>
          ) : null}
        </header>

        {!hasUrl ? (
          <p className="text-center text-2xl text-zinc-300">
            Live leaderboard is currently unavailable.
          </p>
        ) : event === undefined ? (
          <p className="text-center text-2xl text-zinc-400">Loading event…</p>
        ) : event === null ? (
          <p className="text-center text-2xl text-zinc-400">
            Waiting for the event to go live.
          </p>
        ) : (
          <LeaderboardPanel
            projection
            limit={DISPLAY_LIMIT}
            eventId={event._id}
          />
        )}
      </div>
    </div>
  );
}
