"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageShell } from "@/components/page-shell";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { RouteError } from "@/components/route-error";

/**
 * Visitor quiz flow. Shows one question at a time, hides scoring until the
 * final answer triggers `completeQuizSession`. Backtracking is disabled.
 *
 * Resumption: progress is keyed off `getSessionAnsweredCount` from Convex, so
 * a reload mid-quiz lands the visitor on the next unanswered question. If all
 * questions are answered but the session is still `in_progress` (e.g. the
 * visitor closed the tab during finalize), an effect calls
 * `completeQuizSession` and redirects to `/results`.
 */
export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Quiz">
          <LoadingPlaceholder label="Loading quiz…" />
        </PageShell>
      }
    >
      <QuizPageInner />
    </Suspense>
  );
}

function QuizPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventSlug = searchParams.get("event") ?? "";
  const sessionIdParam = searchParams.get("sessionId") ?? "";
  const sessionId = sessionIdParam as Id<"quizSessions">;
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  const event = useQuery(
    api.events.getActiveEventBySlug,
    hasUrl && eventSlug ? { slug: eventSlug } : "skip",
  );

  const result = useQuery(
    api.quizSessions.getQuizResult,
    hasUrl && sessionIdParam ? { sessionId } : "skip",
  );

  const questions = useQuery(
    api.questions.listActiveQuestions,
    hasUrl && event ? { eventId: event._id } : "skip",
  );

  const answeredCount = useQuery(
    api.quizSessions.getSessionAnsweredCount,
    hasUrl && sessionIdParam ? { sessionId } : "skip",
  );

  const submitAnswer = useMutation(api.answers.submitAnswer);
  const completeQuiz = useMutation(api.quizSessions.completeQuizSession);

  const [localIndex, setLocalIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const completingRef = useRef(false);

  useEffect(() => {
    if (result?.status === "completed" && sessionIdParam) {
      router.replace(`/results?sessionId=${sessionIdParam}`);
    }
  }, [result?.status, sessionIdParam, router]);

  // When the visitor lands on a session that already has all answers but is
  // still `in_progress` (e.g. they reloaded mid-finalize), kick off
  // `completeQuizSession` once. We only flip a ref here - the render path
  // already shows the "Completing your quiz…" card when `currentIndex >=
  // total`, so we don't need to update React state from inside the effect
  // (which would trip the `react-hooks/set-state-in-effect` rule).
  useEffect(() => {
    if (completingRef.current) return;
    if (
      result?.status !== "in_progress" ||
      !event ||
      questions === undefined ||
      answeredCount === undefined
    ) {
      return;
    }
    if (questions.length > 0 && answeredCount >= questions.length) {
      completingRef.current = true;
      void (async () => {
        try {
          await completeQuiz({ eventId: event._id, sessionId });
          router.replace(`/results?sessionId=${sessionIdParam}`);
        } catch {
          completingRef.current = false;
        }
      })();
    }
  }, [
    result?.status,
    event,
    questions,
    answeredCount,
    sessionId,
    sessionIdParam,
    router,
    completeQuiz,
  ]);

  if (!hasUrl) {
    return (
      <PageShell title="Quiz">
        <ErrorPlaceholder title="Live data is unavailable">
          The quiz isn’t connected right now. Please check back shortly or contact
          the event organiser.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  if (!eventSlug || !sessionIdParam) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="No quiz in progress"
          description={
            <>
              The quiz page is opened automatically after you start an
              attempt from the landing page. Head home to begin.
            </>
          }
          primaryHref="/"
          primaryLabel="Start from home"
          secondary={{ href: "/leaderboard", label: "View leaderboard" }}
        />
      </div>
    );
  }

  if (
    event === undefined ||
    result === undefined ||
    questions === undefined ||
    answeredCount === undefined
  ) {
    return (
      <PageShell title="Quiz">
        <LoadingPlaceholder label="Loading quiz…" />
      </PageShell>
    );
  }

  if (event === null) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Event not active"
          description={
            <>
              The event <code className="font-mono">{eventSlug}</code> is not
              active right now.
            </>
          }
          primaryHref="/"
          primaryLabel="Start from home"
        />
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Session not found"
          description="That quiz session no longer exists. Start a fresh attempt from the landing page."
          primaryHref="/"
          primaryLabel="Start from home"
        />
      </div>
    );
  }

  if (result.eventId !== event._id) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Session does not belong to this event"
          description="Start a fresh attempt for this event from the landing page."
          primaryHref="/"
          primaryLabel="Start from home"
        />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <PageShell title={event.title}>
        <ErrorPlaceholder title="Quiz isn’t ready yet">
          Questions are still being set up for this event. Please check back
          shortly or contact the event organiser.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const total = sortedQuestions.length;
  const currentIndex = localIndex ?? answeredCount;

  if (completing || currentIndex >= total) {
    return (
      <PageShell title={event.title}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="inline-flex size-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900/60 dark:border-t-emerald-400" />
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Completing your quiz…
          </p>
          <p className="text-sm text-zinc-500">
            Calculating score and rating. Hang tight!
          </p>
        </div>
      </PageShell>
    );
  }

  const current = sortedQuestions[currentIndex];
  const isLast = currentIndex === total - 1;
  const progressPct = (currentIndex / total) * 100;

  async function handleSubmit() {
    if (selected === null || submitting || completing) return;
    if (!event || !current) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitAnswer({
        eventId: event._id,
        sessionId,
        questionId: current._id,
        selectedAnswerIndex: selected,
      });
      if (isLast) {
        completingRef.current = true;
        setCompleting(true);
        await completeQuiz({ eventId: event._id, sessionId });
        router.replace(`/results?sessionId=${sessionIdParam}`);
        return;
      }
      setLocalIndex(currentIndex + 1);
      setSelected(null);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not submit answer.",
      );
      completingRef.current = false;
      setCompleting(false);
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = completing
    ? "Completing quiz…"
    : submitting
      ? "Saving…"
      : isLast
        ? "Submit final answer"
        : "Next question";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 md:overflow-hidden md:py-5">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 md:gap-4">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-lg">
            {event.title}
          </h1>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Hi {result.visitorName} · Question {currentIndex + 1} of {total}
          </p>
        </header>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-label="Quiz progress"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-5">
          <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50 sm:text-xl md:text-2xl">
            {current.question}
          </h2>

          <ul className="grid gap-2 sm:gap-2.5">
            {current.options.map((opt: string, i: number) => {
              const checked = selected === i;
              return (
                <li key={i}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition sm:px-4 sm:py-3 ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-500 dark:bg-emerald-950/40 dark:ring-emerald-900/60"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/80"
                    } ${submitting || completing ? "pointer-events-none opacity-70" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`answer-${current._id}`}
                      value={i}
                      checked={checked}
                      onChange={() => setSelected(i)}
                      className="sr-only"
                      disabled={submitting || completing}
                    />
                    <span
                      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                        checked
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-zinc-50 sm:text-base">
                      {opt}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {submitError ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected === null || submitting || completing}
            className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:text-lg"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
