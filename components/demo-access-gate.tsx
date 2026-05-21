"use client";

import type { FormEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useDemoAccess } from "@/lib/use-demo-access";

const PROTECTED_ROUTES = new Set([
  "/",
  "/leaderboard",
  "/display",
  "/admin",
  "/admin/questions",
  "/admin/analytics",
  "/quiz",
  "/results",
]);

function isProtectedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_ROUTES.has(pathname);
}

export function DemoAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hydrated, isUnlocked, unlock } = useDemoAccess();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const demoAccessCode = process.env.NEXT_PUBLIC_DEMO_ACCESS_CODE?.trim() ?? "";
  const isConfigured = demoAccessCode.length > 0;
  const allowWithoutCode =
    !isConfigured && process.env.NODE_ENV !== "production";

  if (!isProtectedPath(pathname) || allowWithoutCode) {
    return <>{children}</>;
  }

  if (!isConfigured) {
    return (
      <DemoAccessScreen>
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Demo access is not configured for this deployment.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Please contact the EventPulse team for an updated demo link.
          </p>
        </div>
      </DemoAccessScreen>
    );
  }

  if (!hydrated) {
    return (
      <DemoAccessScreen>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Checking demo access...
        </p>
      </DemoAccessScreen>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (input.trim() === demoAccessCode) {
      unlock();
      setInput("");
      return;
    }

    setError("That code did not work. Please try again.");
  }

  return (
    <DemoAccessScreen>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <label htmlFor="demo-access-code" className="block text-left">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Demo access code
          </span>
          <input
            id="demo-access-code"
            type="password"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            autoFocus
            spellCheck={false}
            required
            className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
        >
          Continue
        </button>
      </form>
    </DemoAccessScreen>
  );
}

function DemoAccessScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-emerald-900/5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-6 space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">
              EventPulse Demo
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Enter the demo access code to continue.
            </h1>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
