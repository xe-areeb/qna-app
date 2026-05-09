export function LoadingPlaceholder({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200" />
      {label}
    </div>
  );
}
