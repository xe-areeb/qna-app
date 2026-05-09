export function ConvexEnvBanner() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      Set{" "}
      <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/60">
        NEXT_PUBLIC_CONVEX_URL
      </code>{" "}
      after running{" "}
      <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/60">
        npx convex dev
      </code>
      . Live Convex hooks are skipped until then.
    </div>
  );
}
