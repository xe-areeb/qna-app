"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageShell } from "@/components/page-shell";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";

const DEMO_EVENT_SLUG = "demo-event";

export default function LeaderboardPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const event = useQuery(
    api.events.getActiveEventBySlug,
    hasUrl ? { slug: DEMO_EVENT_SLUG } : "skip",
  );

  return (
    <PageShell
      title="Leaderboard"
      description={
        event && event !== null
          ? `Live rankings for ${event.title}. Highest score first, then fastest time.`
          : "Per-event live rankings. Highest score first, then fastest time."
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500"
        >
          Take the quiz
        </Link>
        <Link
          href="/display"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Open projection screen
        </Link>
      </div>

      {!hasUrl ? (
        <ErrorPlaceholder title="Live data is unavailable">
          The leaderboard isn’t connected right now. Please check back shortly or
          contact the event organiser.
        </ErrorPlaceholder>
      ) : event === undefined ? (
        <LoadingPlaceholder label="Loading event…" />
      ) : event === null ? (
        <ErrorPlaceholder title="Event not ready yet">
          Rankings will appear once the organiser opens the quiz. Please check
          back shortly.
        </ErrorPlaceholder>
      ) : (
        <LeaderboardPanel projection={false} limit={50} eventId={event._id} />
      )}
    </PageShell>
  );
}
