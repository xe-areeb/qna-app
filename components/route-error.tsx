import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared "polished" error state for direct-route hits that are missing
 * required URL params (e.g. `/quiz` without `?event=&sessionId=`).
 *
 * Renders a centred card with a title, supporting copy, and a primary
 * "Start from home" CTA. A second secondary action can be supplied via
 * `secondary`.
 */
export function RouteError({
  title,
  description,
  primaryHref = "/",
  primaryLabel = "Start from home",
  secondary,
}: {
  title: string;
  description?: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {description ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
        >
          {primaryLabel}
        </Link>
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
