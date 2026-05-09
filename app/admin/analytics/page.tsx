"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageShell } from "@/components/page-shell";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { AdminGate } from "@/components/admin-gate";

/**
 * Admin analytics dashboard (per event).
 *
 * Wrapped in `AdminGate`: the inner page only renders once the visitor has
 * unlocked at `/admin`. The unlocked `adminCode` is forwarded to both
 * analytics queries (which now require it) plus the reset-responses button.
 *
 * Reads from `analytics.getEventAnalytics` (top-level totals) and
 * `analytics.getQuestionAnalytics` (per-question correctness). Both are
 * scoped to the selected event.
 *
 * TODO(auth): replace the MVP shared-code gate with Convex Auth + role
 * checks before deployment.
 */

type EventStatus = "draft" | "active" | "archived";

type EventDoc = {
  _id: Id<"events">;
  title: string;
  slug: string;
  status: EventStatus;
};

function formatTime(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function AdminAnalyticsPage() {
  return (
    <AdminGate>
      {({ adminCode }) => <AdminAnalyticsInner adminCode={adminCode} />}
    </AdminGate>
  );
}

function AdminAnalyticsInner({ adminCode }: { adminCode: string }) {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const events = useQuery(
    api.events.listEvents,
    hasUrl ? {} : "skip",
  ) as EventDoc[] | undefined;

  const [pickedEventId, setPickedEventId] = useState<Id<"events"> | null>(null);

  const selectedEventId = useMemo<Id<"events"> | null>(() => {
    if (!events || events.length === 0) return null;
    if (pickedEventId && events.some((e) => e._id === pickedEventId)) {
      return pickedEventId;
    }
    const firstActive = events.find((e) => e.status === "active") ?? events[0];
    return firstActive._id;
  }, [events, pickedEventId]);

  const selectedEvent = useMemo(
    () => events?.find((e) => e._id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const totals = useQuery(
    api.analytics.getEventAnalytics,
    hasUrl && selectedEventId
      ? { adminCode, eventId: selectedEventId }
      : "skip",
  );
  const perQuestion = useQuery(
    api.analytics.getQuestionAnalytics,
    hasUrl && selectedEventId
      ? { adminCode, eventId: selectedEventId }
      : "skip",
  );

  if (!hasUrl) {
    return (
      <PageShell title="Analytics">
        <ErrorPlaceholder title="Analytics are unavailable">
          The admin area isn’t connected right now. Please contact the event
          organiser.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Analytics"
      description="Per-event totals and question-by-question correctness."
    >
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <label
          htmlFor="event-picker"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Event
        </label>
        {events === undefined ? (
          <LoadingPlaceholder label="Loading events…" />
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No events yet. Set one up from{" "}
            <a
              href="/admin/questions"
              className="font-semibold text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
            >
              Questions
            </a>
            .
          </p>
        ) : (
          <select
            id="event-picker"
            value={selectedEventId ?? ""}
            onChange={(e) => setPickedEventId(e.target.value as Id<"events">)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.title} · {event.status}
              </option>
            ))}
          </select>
        )}
      </section>

      {selectedEvent ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Showing analytics for{" "}
          <strong className="text-zinc-900 dark:text-zinc-50">
            {selectedEvent.title}
          </strong>{" "}
          <code className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {selectedEvent.slug}
          </code>
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Completed participants"
          value={totals?.totalCompleted ?? null}
          loading={totals === undefined}
          format={(n) => n.toString()}
        />
        <Stat
          label="In-progress sessions"
          value={totals?.totalInProgress ?? null}
          loading={totals === undefined}
          format={(n) => n.toString()}
          subtle
        />
        <Stat
          label="Average score"
          value={totals?.averageScore ?? null}
          loading={totals === undefined}
          format={(n) =>
            `${n.toFixed(1)}${
              totals?.totalActiveQuestions
                ? ` / ${totals.totalActiveQuestions}`
                : ""
            }`
          }
          empty="No completed runs"
        />
        <Stat
          label="Highest score"
          value={totals?.highestScore ?? null}
          loading={totals === undefined}
          format={(n) =>
            `${n}${
              totals?.totalActiveQuestions
                ? ` / ${totals.totalActiveQuestions}`
                : ""
            }`
          }
          empty="No completed runs"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Average percentage"
          value={totals?.averagePercentage ?? null}
          loading={totals === undefined}
          format={(n) => `${n.toFixed(1)}%`}
          empty="No completed runs"
        />
        <Stat
          label="Fastest top-scorer time"
          value={totals?.fastestTime ?? null}
          loading={totals === undefined}
          format={(n) => formatTime(n)}
          empty="No completed runs"
        />
        <Stat
          label="Active questions"
          value={totals?.totalActiveQuestions ?? null}
          loading={totals === undefined}
          format={(n) => n.toString()}
        />
        <PlaceholderStat label="Daily completion trend" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Question-wise correctness
          </h2>
          <span className="text-xs text-zinc-500">
            {perQuestion ? `${perQuestion.length} questions` : ""}
          </span>
        </header>

        {!selectedEventId ? (
          <p className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
            Pick an event to see question stats.
          </p>
        ) : perQuestion === undefined ? (
          <div className="px-4 py-6">
            <LoadingPlaceholder label="Loading question analytics…" />
          </div>
        ) : perQuestion.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
            No active questions in this event yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {perQuestion.map((q) => (
              <li
                key={q.questionId}
                className="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono text-xs text-zinc-500">
                      #{q.order}
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {q.question}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {q.totalAnswers} answer{q.totalAnswers === 1 ? "" : "s"}
                    {q.totalAnswers > 0
                      ? ` · ${q.correctCount} correct`
                      : ""}
                  </p>
                </div>
                <div className="w-full max-w-[200px]">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Correct
                    </span>
                    <span className="tabular-nums text-zinc-500">
                      {q.correctPercentage != null
                        ? `${q.correctPercentage}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${barTone(q.correctPercentage)}`}
                      style={{
                        width: `${q.correctPercentage ?? 0}%`,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResetDemoButton adminCode={adminCode} />
    </PageShell>
  );
}

function barTone(pct: number | null): string {
  if (pct == null) return "bg-zinc-300 dark:bg-zinc-700";
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-sky-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-red-500";
}

function Stat({
  label,
  value,
  loading,
  format,
  empty = "—",
  subtle = false,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  format: (n: number) => string;
  empty?: string;
  subtle?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        subtle
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {loading ? (
          <span className="text-base text-zinc-400">…</span>
        ) : value == null ? (
          <span className="text-base font-normal text-zinc-400">{empty}</span>
        ) : (
          format(value)
        )}
      </p>
    </div>
  );
}

function PlaceholderStat({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/30">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-base font-medium text-zinc-500">
        Coming soon
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Placeholder · charts arrive once Convex aggregates land.
      </p>
    </div>
  );
}
