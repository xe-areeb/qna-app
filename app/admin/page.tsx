"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageShell } from "@/components/page-shell";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { useAdminUnlock } from "@/lib/use-admin-unlock";

/**
 * `/admin` - the entry point for the demo admin gate.
 *
 * Locked → shows a single-input unlock form. Submission calls the
 * `verifyAdminCode` Convex mutation (which throws on a bad / unset code) and
 * stores the code in `sessionStorage` via `useAdminUnlock`.
 *
 * Unlocked → shows the admin sub-nav (Questions, Analytics) plus a "Lock
 * admin" button that wipes the cached code.
 */
export default function AdminLandingPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const { code, hydrated, isUnlocked, unlock, lock } = useAdminUnlock();
  const isAdminConfigured = useQuery(
    api.adminAuth.isAdminConfigured,
    hasUrl ? {} : "skip",
  );
  const verifyAdminCode = useMutation(api.adminAuth.verifyAdminCode);

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasUrl) {
    return (
      <PageShell title="Admin">
        <ErrorPlaceholder title="Admin tools are unavailable">
          The admin area isn’t connected right now. Please contact the event
          organiser.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  if (!hydrated) {
    return (
      <PageShell title="Admin">
        <LoadingPlaceholder label="Checking admin access…" />
      </PageShell>
    );
  }

  async function handleUnlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Enter the admin access code.");
      return;
    }
    setSubmitting(true);
    try {
      await verifyAdminCode({ adminCode: trimmed });
      unlock(trimmed);
      setInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, "")
          : "Could not verify admin code.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isUnlocked && code) {
    return (
      <PageShell
        title="Admin"
        description="Admin tools are unlocked for this browser tab. Pick a tool below."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminLink
            href="/admin/questions"
            title="Questions"
            description="Manage event questions, set up the demo event, and reset responses."
          />
          <AdminLink
            href="/admin/analytics"
            title="Analytics"
            description="Per-event totals and per-question correctness."
          />
        </div>

        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                Session
              </p>
              <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Lock admin
              </h3>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                Sign out of the admin tools for this browser tab. You’ll need
                to re-enter the access code before using them again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => lock()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-amber-600 bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-500"
            >
              Lock admin
            </button>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin"
      description="Admin access is required to manage questions, analytics, and event controls. Enter the access code to continue."
    >
      {isAdminConfigured === false ? (
        <ErrorPlaceholder title="Admin access is not yet available">
          Admin access hasn’t been set up for this deployment yet. Please
          contact the event organiser.
        </ErrorPlaceholder>
      ) : null}

      <form
        onSubmit={handleUnlock}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
        noValidate
      >
        <label htmlFor="admin-code" className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Admin access code
          </span>
          <input
            id="admin-code"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={submitting || isAdminConfigured === false}
            autoComplete="off"
            spellCheck={false}
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>

        {error ? (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || isAdminConfigured === false}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Verifying…" : "Unlock admin"}
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Back to home
          </Link>
        </div>
      </form>

      <p className="text-xs text-zinc-500">
        Access is verified securely. Your code is remembered for this browser
        tab only and is cleared when you lock admin or close the tab.
      </p>
    </PageShell>
  );
}

function AdminLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-500"
    >
      <span className="text-base font-semibold text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-50 dark:group-hover:text-emerald-400">
        {title}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </span>
    </Link>
  );
}
