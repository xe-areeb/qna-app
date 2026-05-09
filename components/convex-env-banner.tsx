/**
 * Soft banner shown only when the live data backend URL has not been
 * configured for this build. The wording is intentionally non-technical -
 * configuration details for operators live in the project docs, not in the
 * UI.
 */
export function ConvexEnvBanner() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      Live data is unavailable. Please contact the event organiser.
    </div>
  );
}
