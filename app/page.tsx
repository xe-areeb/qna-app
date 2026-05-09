"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";

const DEMO_EVENT_SLUG = "demo-event";

/**
 * Build the per-event visitor identifier from a chosen display name.
 *
 * NOTE: This is a *temporary* identity stand-in until visitor auth is wired.
 * It deliberately means two visitors who both type "Alice" on the same event
 * collide and share a single attempt - acceptable for a demo, **not** for a
 * public competition. Replace once Convex Auth is integrated.
 */
function visitorIdentifier(eventId: Id<"events">, displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `${eventId}:${slug}`;
}

function nameSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function HomePage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const event = useQuery(
    api.events.getActiveEventBySlug,
    hasUrl ? { slug: DEMO_EVENT_SLUG } : "skip",
  );
  const questions = useQuery(
    api.questions.listActiveQuestions,
    hasUrl && event ? { eventId: event._id } : "skip",
  );

  const createSession = useMutation(api.quizSessions.createQuizSession);
  const router = useRouter();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const slug = useMemo(() => nameSlug(trimmed), [trimmed]);
  const nameValid = trimmed.length >= 2 && slug.length > 0;
  const totalQuestions = questions?.length ?? null;

  if (!hasUrl) {
    return (
      <Centered>
        <ErrorPlaceholder title="Live data is unavailable">
          The event isn’t connected right now. Please check back shortly or
          contact the event organiser.
        </ErrorPlaceholder>
      </Centered>
    );
  }

  if (event === undefined) {
    return (
      <Centered>
        <LoadingPlaceholder label="Loading event…" />
      </Centered>
    );
  }

  if (event === null) {
    return (
      <Centered>
        <ErrorPlaceholder title="Event not ready yet">
          The quiz hasn’t been opened by the organiser yet. Please check back
          shortly.
        </ErrorPlaceholder>
      </Centered>
    );
  }

  async function handleStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    setError(null);

    if (trimmed.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (!slug) {
      setError("Display name needs at least one letter or number.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSession({
        eventId: event._id,
        visitorName: trimmed,
        visitorIdentifier: visitorIdentifier(event._id, trimmed),
      });
      if (result.status === "completed") {
        router.push(`/results?sessionId=${result.sessionId}`);
      } else {
        router.push(
          `/quiz?event=${encodeURIComponent(event.slug)}&sessionId=${result.sessionId}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the quiz.");
      setSubmitting(false);
    }
  }

  return (
    <Centered>
      <div className="w-full max-w-xl space-y-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
          EventPulse
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-5xl">
          {event.title}
        </h1>
        <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
          Live quiz engagement and audience rankings for events.
        </p>
        {event.description ? (
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            {event.description}
          </p>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-left text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            How it works
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span aria-hidden className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>
                {totalQuestions != null ? (
                  <>
                    Answer <strong>{totalQuestions}</strong> multiple-choice questions, one at a time.
                  </>
                ) : (
                  <>Answer the multiple-choice questions, one at a time.</>
                )}
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>
                Your score, percentage, and rating are revealed{" "}
                <strong>only after the final question</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>
                Each display name can complete{" "}
                <strong>only one attempt</strong> for this event.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>
                Backtracking is disabled - pick the answer you mean to commit to.
              </span>
            </li>
          </ul>
        </div>

        <form
          onSubmit={handleStart}
          className="flex flex-col items-center gap-4"
          noValidate
        >
          <label className="w-full max-w-md text-left">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Display name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
              minLength={2}
              maxLength={40}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. Alex"
              aria-invalid={Boolean(error)}
              className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              2–40 characters · letters, numbers and spaces work best.
            </span>
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="submit"
              disabled={submitting || !nameValid}
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Starting…" : "Start quiz"}
            </button>
            <Link
              href="/leaderboard"
              className="inline-flex h-12 min-w-[180px] items-center justify-center rounded-full border border-zinc-300 bg-white px-8 text-base font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              View leaderboard
            </Link>
          </div>
          <p className="text-xs text-zinc-500">
            Returning with the same name? You’ll resume an in-progress run, or
            jump straight to your result if you’ve already finished.
          </p>
        </form>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {children}
    </div>
  );
}
