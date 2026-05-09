"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { LoadingPlaceholder } from "@/components/loading-placeholder";

/**
 * Format a duration in milliseconds as `Mm Ss` (e.g. `2m 14s`) or `Ss`
 * (e.g. `42.3s`).
 */
function formatTime(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

const MEDAL: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function LeaderboardPanel({
  projection = false,
  limit = 50,
  eventId,
}: {
  projection?: boolean;
  limit?: number;
  /**
   * Optional event scope. Without it, the live query returns an empty list
   * (per the temporary getLeaderboard contract). UI selection of the active
   * event will replace this once the event picker lands.
   */
  eventId?: Id<"events">;
}) {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const rows = useQuery(
    api.quizSessions.getLeaderboard,
    hasUrl ? { limit, eventId } : "skip",
  );

  if (!hasUrl) {
    return (
      <ErrorPlaceholder title="Convex URL not configured">
        Add <code className="font-mono text-xs">NEXT_PUBLIC_CONVEX_URL</code> from{" "}
        <code className="font-mono text-xs">npx convex dev</code> to load live rankings.
      </ErrorPlaceholder>
    );
  }

  if (rows === undefined) {
    return <LoadingPlaceholder label="Fetching leaderboard…" />;
  }

  if (rows.length === 0) {
    if (!eventId) {
      return projection ? (
        <p className="text-2xl text-zinc-500 md:text-3xl">
          Select an event to see its leaderboard.
        </p>
      ) : (
        <EmptyState
          title="Select an event"
          message="Per-event rankings appear here once visitors complete a quiz."
        />
      );
    }
    return projection ? (
      <p className="text-center text-2xl text-zinc-400 md:text-3xl">
        Waiting for the first finisher…
      </p>
    ) : (
      <EmptyState
        title="No completed runs yet"
        message="As soon as someone finishes the quiz, they’ll appear here in real time."
      />
    );
  }

  if (projection) {
    return <ProjectionList rows={rows} />;
  }
  return <CompactList rows={rows} />;
}

type LeaderboardRow = FunctionReturnType<
  typeof api.quizSessions.getLeaderboard
>[number];

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </div>
  );
}

function CompactList({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <ol className="space-y-3">
      {rows.map((row, i) => {
        const rank = i + 1;
        const isTop = rank <= 3;
        const accent =
          rank === 1
            ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-950/30"
            : rank === 2
              ? "border-zinc-400 bg-zinc-50 dark:border-zinc-500/60 dark:bg-zinc-800/40"
              : rank === 3
                ? "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-950/30"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40";
        return (
          <li
            key={row._id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border ${accent} px-4 py-3 sm:gap-6`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${
                  isTop
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {isTop ? MEDAL[rank] : rank}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {row.visitorName ?? "Anonymous"}
                </p>
                <p className="text-xs text-zinc-500">
                  {row.percentage != null ? `${row.percentage}%` : "—"}
                  {row.rating ? ` · ${row.rating}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-3 text-right tabular-nums">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {row.score ?? 0}
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  /{row.totalQuestions ?? "?"}
                </span>
              </span>
              <span className="text-xs text-zinc-500">
                {formatTime(row.timeTaken)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ProjectionList({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <ol className="space-y-4 md:space-y-5">
      {rows.map((row, i) => {
        const rank = i + 1;
        const isTop = rank <= 3;
        const cardAccent =
          rank === 1
            ? "from-amber-400/20 via-amber-500/10 to-transparent ring-amber-400/40"
            : rank === 2
              ? "from-zinc-300/20 via-zinc-400/10 to-transparent ring-zinc-300/30"
              : rank === 3
                ? "from-orange-400/20 via-orange-500/10 to-transparent ring-orange-400/40"
                : "from-white/5 via-white/0 to-transparent ring-white/10";
        return (
          <li
            key={row._id}
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r ${cardAccent} px-5 py-4 ring-1 backdrop-blur-sm md:px-8 md:py-6`}
          >
            <div className="flex min-w-0 items-center gap-4 md:gap-6">
              <span
                className={`inline-flex shrink-0 items-center justify-center font-mono font-bold tabular-nums ${
                  isTop
                    ? "text-4xl md:text-6xl"
                    : "text-3xl text-zinc-400 md:text-5xl"
                }`}
              >
                {isTop ? MEDAL[rank] : `#${rank}`}
              </span>
              <div className="min-w-0">
                <p className="truncate text-3xl font-bold tracking-tight md:text-5xl">
                  {row.visitorName ?? "Anonymous"}
                </p>
                <p className="mt-1 text-base text-zinc-400 md:text-xl">
                  {row.percentage != null ? `${row.percentage}%` : "—"}
                  {row.rating ? ` · ${row.rating}` : ""}
                  {" · "}
                  {formatTime(row.timeTaken)}
                </p>
              </div>
            </div>
            <span className="text-right text-3xl font-semibold tabular-nums md:text-5xl">
              {row.score ?? 0}
              <span className="ml-1 text-zinc-500">
                /{row.totalQuestions ?? "?"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
