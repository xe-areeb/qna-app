"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ErrorPlaceholder } from "@/components/error-placeholder";

/**
 * Danger-zone "reset demo responses" panel.
 *
 * Wraps `api.seed.resetDemoEventResponses` with a browser `confirm` dialog,
 * loading state, and result feedback. Only the admin gate renders this
 * component — it requires an `adminCode` from `useAdminUnlock` and forwards
 * it to the protected mutation.
 *
 * **What it deletes**: every `quizSessions` row + every `answers` row scoped
 * to the demo event. **What it preserves**: the event itself and all of its
 * questions (active or inactive).
 *
 * After a successful reset, live queries (analytics, leaderboard, display)
 * refresh themselves — the panels show their empty state until a new visitor
 * completes the quiz.
 */

type ResetResult = {
  deletedSessions: number;
  deletedAnswers: number;
  eventFound: boolean;
};

type ResetStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; result: ResetResult }
  | { state: "error"; message: string };

const CONFIRM_MESSAGE =
  "Reset demo responses?\n\n" +
  "This deletes ALL visitor attempts and answers for the demo event.\n" +
  "It does NOT delete the event or its questions.\n\n" +
  "Analytics, leaderboard, and display will go back to empty until someone " +
  "plays again.";

export function ResetDemoButton({
  adminCode,
  compact = false,
}: {
  adminCode: string;
  compact?: boolean;
}) {
  const resetResponses = useMutation(api.seed.resetDemoEventResponses);
  const [status, setStatus] = useState<ResetStatus>({ state: "idle" });

  async function handleReset() {
    if (typeof window !== "undefined" && !window.confirm(CONFIRM_MESSAGE)) {
      return;
    }
    setStatus({ state: "loading" });
    try {
      const result = (await resetResponses({ adminCode })) as ResetResult;
      setStatus({ state: "ok", result });
    } catch (e) {
      setStatus({
        state: "error",
        message: e instanceof Error ? e.message : "Reset failed.",
      });
    }
  }

  return (
    <section
      className={`rounded-2xl border-2 border-red-200 bg-red-50/60 ${
        compact ? "p-4" : "p-5"
      } dark:border-red-900/60 dark:bg-red-950/20`}
      aria-labelledby="danger-zone-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            id="danger-zone-title"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-300"
          >
            Danger zone
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Reset demo responses
          </h3>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            Deletes every visitor attempt and answer for the{" "}
            <code className="font-mono text-xs">demo-event</code>. The event
            itself and its questions are preserved. Analytics, leaderboard,
            and display will go back to empty.
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Gated by the MVP admin code only — replace with proper auth
            before deployment.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={status.state === "loading"}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-red-600 bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.state === "loading" ? "Resetting…" : "Reset responses"}
        </button>
      </div>

      {status.state === "ok" ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-100">
          {status.result.eventFound ? (
            <>
              Reset complete · cleared{" "}
              <strong>{status.result.deletedSessions}</strong> session
              {status.result.deletedSessions === 1 ? "" : "s"} and{" "}
              <strong>{status.result.deletedAnswers}</strong> answer
              {status.result.deletedAnswers === 1 ? "" : "s"}.
            </>
          ) : (
            <>
              Demo event isn’t seeded yet, so there was nothing to clear.
            </>
          )}
        </div>
      ) : null}

      {status.state === "error" ? (
        <div className="mt-3">
          <ErrorPlaceholder title="Reset failed">
            {status.message}
          </ErrorPlaceholder>
        </div>
      ) : null}
    </section>
  );
}
