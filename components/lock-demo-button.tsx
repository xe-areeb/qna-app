"use client";

import { useDemoAccess } from "@/lib/use-demo-access";

export function LockDemoButton() {
  const { hydrated, isUnlocked, lock } = useDemoAccess();
  const isConfigured =
    (process.env.NEXT_PUBLIC_DEMO_ACCESS_CODE?.trim() ?? "").length > 0;

  if (!isConfigured || !hydrated || !isUnlocked) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={lock}
      className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
    >
      Lock demo
    </button>
  );
}
