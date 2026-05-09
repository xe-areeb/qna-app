"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ConvexEnvBanner } from "@/components/convex-env-banner";
import { SiteHeader } from "@/components/site-header";

/**
 * Wraps app content with the global header / footer / Convex env banner -
 * **except** on routes meant for external projection (currently `/display`),
 * where the chrome is hidden so the page can use the full viewport at a high
 * contrast.
 *
 * Footer is hidden on `/` and `/quiz` so the kiosk-style hero and the active
 * question fit laptop / tablet viewports without scrolling alongside the
 * header.
 *
 * `usePathname` is read on both server and client, so a direct visit to a
 * "naked" route renders without chrome from the first paint (no flash).
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const naked = pathname === "/display" || pathname?.startsWith("/display/");
  const hideFooter =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/quiz" ||
    pathname?.startsWith("/quiz/") === true;

  if (naked) {
    return <main className="flex min-h-0 flex-1 flex-col">{children}</main>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConvexEnvBanner />
      <SiteHeader />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {!hideFooter ? (
        <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          EventPulse · Live quiz engagement and audience rankings for events.
        </footer>
      ) : null}
    </div>
  );
}
