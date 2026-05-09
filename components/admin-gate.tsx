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
              Admin access is required to manage questions, analytics, and
              event controls. Sign in with your access code to continue.
            </>
          }
          primaryHref="/admin"
          primaryLabel="Sign in to admin"
          secondary={{ href: "/", label: "Back to home" }}
        />
      </div>
    );
  }

  return <>{children({ adminCode: code, lock })}</>;
}
