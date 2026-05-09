"use client";

import type { ReactNode } from "react";
import { useAdminUnlock } from "@/lib/use-admin-unlock";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { RouteError } from "@/components/route-error";

/**
 * Wraps an admin route. While `useAdminUnlock` hydrates we show a brief
 * loading state; if the user is unlocked we render `children` and pass
 * the cached `adminCode`; otherwise we render a polished
 * "Admin access required" card with a CTA back to `/admin`.
 */
export function AdminGate({
  children,
}: {
  children: (ctx: { adminCode: string; lock: () => void }) => ReactNode;
}) {
  const { code, hydrated, isUnlocked, lock } = useAdminUnlock();

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <LoadingPlaceholder label="Checking admin access…" />
      </div>
    );
  }

  if (!isUnlocked || !code) {
    return (
      <div className="px-4 py-16">
        <RouteError
          title="Admin access required"
          description={
            <>
              This page is locked behind the demo admin code. Head to{" "}
              <code className="font-mono text-xs">/admin</code> to unlock.
            </>
          }
          primaryHref="/admin"
          primaryLabel="Go to admin unlock"
          secondary={{ href: "/", label: "Back to home" }}
        />
      </div>
    );
  }

  return <>{children({ adminCode: code, lock })}</>;
}
