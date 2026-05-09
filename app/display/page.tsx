"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LeaderboardPanel } from "@/components/leaderboard-panel";

const DEMO_EVENT_SLUG = "demo-event";
/** Visible row count on the projection screen. Tuned to fit common 720p / 1080p
 *  projection and laptop screens without page scrolling. */
const DISPLAY_LIMIT = 5;

/**
 * External projection screen. The site chrome (header / footer / Convex
 * banner) is intentionally hidden here via `SiteChrome` so the leaderboard
 * fills the screen. High-contrast dark canvas, oversized type, top 5 rows.
 *
 * Live updates flow through `useQuery` in `LeaderboardPanel`, so finishers
 * appear without a refresh. Layout uses `h-dvh` + `overflow-hidden` so the
 * page behaves like a fixed scoreboard and never scrolls.
 */
export default function DisplayPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const event = useQuery(
    api.events.getActiveEventBySlug,
    hasUrl ? { slug: DEMO_EVENT_SLUG } : "skip",
  );

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-zinc-950 text-white">
      <Link
        href="/leaderboard"
        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-white md:right-5 md:top-5"
      >
        Exit projection
      </Link>

      <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col gap-3 px-5 py-5 md:gap-5 md:px-10 md:py-7">
        <header className="shrink-0 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-emerald-400/90 md:text-base">
            Live leaderboard
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:mt-2 md:text-5xl">
            {event && event !== null ? event.title : "EventPulse"}
          </h1>
          {event && event !== null ? (
            <p className="mt-1 text-sm text-zinc-400 md:text-lg">
              Top {DISPLAY_LIMIT} · highest score first, then fastest time
            </p>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {!hasUrl ? (
            <p className="m-auto text-center text-2xl text-zinc-300">
              Live leaderboard is currently unavailable.
            </p>
          ) : event === undefined ? (
            <p className="m-auto text-center text-2xl text-zinc-400">Loading event…</p>
          ) : event === null ? (
            <p className="m-auto text-center text-2xl text-zinc-400">
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
    </div>
  );
}
