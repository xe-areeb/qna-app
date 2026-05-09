"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageShell } from "@/components/page-shell";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { RouteError } from "@/components/route-error";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Results">
          <LoadingPlaceholder label="Loading your result…" />
        </PageShell>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}

/**
 * Format a duration in milliseconds as `Mm Ss` (e.g. `2m 14s`) or `Ss`
 * for sub-minute runs (e.g. `42.3s`).
 */
function formatTime(ms: number | undefined): string {
  if (ms == null || ms < 0) return "-";
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function rankCopy(
  rank: number | null | undefined,
  total: number | null | undefined,
): string | null {
  if (rank == null || total == null) return null;
  if (total === 0) return null;
  if (rank === 1) return `🏆 You’re #1 of ${total}!`;
  if (rank === 2) return `🥈 You’re #2 of ${total}!`;
  if (rank === 3) return `🥉 You’re #3 of ${total}!`;
  return `Ranked #${rank} of ${total}`;
}

function ResultsInner() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId") ?? "";
  const sessionId = sessionIdParam as Id<"quizSessions">;
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  const result = useQuery(
    api.quizSessions.getQuizResult,
    hasUrl && sessionIdParam ? { sessionId } : "skip",
  );

  const rank = useQuery(
    api.quizSessions.getSessionRank,
    hasUrl && sessionIdParam && result?.status === "completed"
      ? { sessionId }
      : "skip",
  );

  if (!hasUrl) {
    return (
      <PageShell title="Results">
        <ErrorPlaceholder title="Convex URL not configured">
          Set <code className="font-mono text-xs">NEXT_PUBLIC_CONVEX_URL</code>{" "}
          and reload.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  if (!sessionIdParam) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="No result to show"
          description={
            <>
              Results are linked from the quiz flow. Open the landing page and
              start an attempt to get a results link.
            </>
          }
          primaryHref="/"
          primaryLabel="Start from home"
          secondary={{ href: "/leaderboard", label: "View leaderboard" }}
        />
      </div>
    );
  }

  if (result === undefined) {
    return (
      <PageShell title="Results">
        <LoadingPlaceholder label="Loading your result…" />
      </PageShell>
    );
  }

  if (result === null) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Session not found"
          description="We couldn’t find this quiz session - it may have been deleted."
          primaryHref="/"
          primaryLabel="Start from home"
        />
      </div>
    );
  }

  if (result.status !== "completed") {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Quiz still in progress"
          description="You haven’t finished yet. Start from the landing page to resume your attempt."
          primaryHref="/"
          primaryLabel="Resume from home"
        />
      </div>
    );
  }

  const score = result.score ?? 0;
  const total = result.totalQuestions ?? 0;
  const percentage = result.percentage ?? 0;
  const rating = result.rating ?? "-";
  const time = formatTime(result.timeTaken);
  const rankText =
    rank && rank !== null ? rankCopy(rank.rank, rank.total) : null;

  const ratingTone =
    rating === "Champion"
      ? "from-amber-400 via-amber-500 to-amber-600"
      : rating === "Excellent"
        ? "from-emerald-400 via-emerald-500 to-emerald-600"
        : rating === "Good"
          ? "from-sky-400 via-sky-500 to-sky-600"
          : "from-zinc-400 via-zinc-500 to-zinc-600";

  return (
    <PageShell title="Results">
      <div className="space-y-6">
        <div
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${ratingTone} p-1 shadow-xl`}
        >
          <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-white p-6 dark:bg-zinc-950 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Quiz complete
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                  Nice run, {result.visitorName}!
                </h2>
              </div>
              {rankText ? (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {rankText}
                </span>
              ) : null}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
              <Stat label="Score">
                <span className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                  {score}
                  <span className="ml-1 text-base font-normal text-zinc-500">
                    /{total}
                  </span>
                </span>
              </Stat>
              <Stat label="Percentage">
                <span className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                  {percentage}
                  <span className="text-xl text-zinc-500">%</span>
                </span>
              </Stat>
              <Stat label="Rating">
                <span
                  className={`bg-gradient-to-br ${ratingTone} bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl`}
                >
                  {rating}
                </span>
              </Stat>
              <Stat label="Time taken">
                <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  {time}
                </span>
              </Stat>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/leaderboard"
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
          >
            View leaderboard
          </Link>
          <Link
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Open projection screen
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Back to home
          </Link>
        </div>

        <p className="text-xs text-zinc-500">
          Each display name can complete only one attempt for this event.
          Returning to the landing page with the same name lands you straight
          back here.
        </p>
      </div>
    </PageShell>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
