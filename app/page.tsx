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

/** Kiosk headline + supporting line shown to passersby on `/`. */
const HOME_HEADLINE = "Take the Quiz";
const HOME_SUBLINE = "Answer 15 questions and see where you rank.";

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
      <HomeStage>
        <StatusCard>
          <ErrorPlaceholder title="Live data is unavailable">
            The event isn’t connected right now. Please check back shortly or
            contact the event organiser.
          </ErrorPlaceholder>
        </StatusCard>
      </HomeStage>
    );
  }

  if (event === undefined) {
    return (
      <HomeStage>
        <StatusCard>
          <LoadingPlaceholder label="Loading event…" />
        </StatusCard>
      </HomeStage>
    );
  }

  if (event === null) {
    return (
      <HomeStage>
        <StatusCard>
          <ErrorPlaceholder title="Event not ready yet">
            The quiz hasn’t been opened by the organiser yet. Please check back
            shortly.
          </ErrorPlaceholder>
        </StatusCard>
      </HomeStage>
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

  const questionsLabel =
    totalQuestions != null ? `${totalQuestions} questions` : "15 questions";

  return (
    <HomeStage>
      <article className="relative grid w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-emerald-900/10 ring-1 ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-emerald-400/10 dark:ring-white/5 md:grid-cols-[7fr_5fr]">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-400/10"
          />

        <section className="relative flex flex-col justify-center gap-6 bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-8 dark:from-emerald-950/40 dark:via-zinc-900/60 dark:to-zinc-900/60 sm:px-10 sm:py-10 md:px-12 md:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-zinc-900/80 dark:text-emerald-300">
              <span aria-hidden className="inline-block size-1.5 rounded-full bg-emerald-500" />
              EventPulse
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-900/5 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              {event.title}
            </span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-zinc-900 dark:text-white sm:text-6xl md:text-7xl">
            {HOME_HEADLINE}
          </h1>
          <p className="max-w-md text-lg leading-snug text-zinc-700 dark:text-zinc-200 sm:text-xl">
            {HOME_SUBLINE}
          </p>

          <ul className="flex flex-wrap gap-2 pt-1">
            <RuleChip>{questionsLabel}</RuleChip>
            <RuleChip>Score at the end</RuleChip>
            <RuleChip>One attempt per name</RuleChip>
          </ul>
        </section>

        <section className="relative flex flex-col justify-center gap-5 bg-white px-6 py-8 dark:bg-zinc-900/40 sm:px-10 sm:py-10 md:px-12 md:py-12">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
              Ready to play?
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
              Enter your name
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This is what shows up on the leaderboard.
            </p>
          </div>

          <form onSubmit={handleStart} className="flex flex-col gap-4" noValidate>
            <label className="block">
              <span className="sr-only">Display name</span>
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
                placeholder="Your name"
                aria-invalid={Boolean(error)}
                aria-label="Display name"
                className="h-14 w-full rounded-2xl border-2 border-zinc-200 bg-white px-5 text-lg text-zinc-900 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:h-16 sm:text-xl"
              />
            </label>

            {error ? (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !nameValid}
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white shadow-xl shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:text-xl"
            >
              {submitting ? "Starting…" : "Take Quiz Now"}
            </button>

            <Link
              href="/leaderboard"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              View leaderboard
            </Link>

            <p className="text-center text-xs text-zinc-500">
              Use the same name to resume your quiz.
            </p>
          </form>
        </section>
      </article>
    </HomeStage>
  );
}

function RuleChip({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/70 dark:text-zinc-100">
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-emerald-500" />
      {children}
    </li>
  );
}

/**
 * Landing stage. On tablet / desktop the kiosk card fills the available
 * vertical space (header takes the rest) without scrolling. On mobile the
 * stage scrolls naturally.
 */
function HomeStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-stretch overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 md:items-center md:justify-center md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center md:flex-none">
        {children}
      </div>
    </div>
  );
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-emerald-900/5 ring-1 ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/60 dark:ring-white/5">
      {children}
    </div>
  );
}
