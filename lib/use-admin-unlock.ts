"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * MVP admin unlock state, persisted in `sessionStorage`.
 *
 * The flow:
 *   1. `/admin` runs `verifyAdminCode` against the Convex env-var secret.
 *   2. On success, the page calls `unlock(code)`, which writes the code into
 *      `sessionStorage`.
 *   3. Other admin pages call `useAdminUnlock()` and get the cached code so
 *      they can pass it as the `adminCode` arg to protected mutations and
 *      queries.
 *
 * Implementation: `useSyncExternalStore` reads `sessionStorage` on every
 * render and subscribes to a local pub/sub bus + the cross-tab `storage`
 * event so reads stay consistent. During SSR / the very first client paint
 * the hook returns the server snapshot (`hydrated: false, code: null`); the
 * second render swaps in the real client snapshot. This avoids the React 19
 * `set-state-in-effect` rule and any flash of stale content.
 *
 * **NOT a real auth boundary.** SessionStorage is per-tab and trivially
 * inspectable. Replace with Convex Auth + role check before public deploy.
 */

const STORAGE_KEY = "qna:admin-code";

type Snapshot = { hydrated: boolean; code: string | null };

const SERVER_SNAPSHOT: Snapshot = { hydrated: false, code: null };

// Stable cached client snapshot - `useSyncExternalStore` requires the
// snapshot reference to stay equal between renders if the underlying value
// hasn't changed (otherwise React believes it changed and re-renders forever).
let clientSnapshot: Snapshot = { hydrated: true, code: null };

function readClientSnapshot(): Snapshot {
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // sessionStorage may be blocked (private mode, sandboxed iframe).
    value = null;
  }
  if (clientSnapshot.code !== value) {
    clientSnapshot = { hydrated: true, code: value };
  }
  return clientSnapshot;
}

const localSubscribers = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  localSubscribers.add(callback);
  // `storage` only fires for OTHER tabs - combine with the local bus below
  // so writes inside this tab also trigger re-reads.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key == null) callback();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    localSubscribers.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function notifyLocal() {
  for (const cb of localSubscribers) cb();
}

type AdminUnlockState = {
  /** The cached admin code, or `null` if locked / not hydrated yet. */
  code: string | null;
  /** `true` once we've read sessionStorage on the client. */
  hydrated: boolean;
  /** Convenience: `code !== null` AND we've hydrated. */
  isUnlocked: boolean;
  /** Persist `code` and flip to unlocked. */
  unlock: (code: string) => void;
  /** Wipe the cached code and flip back to locked. */
  lock: () => void;
};

export function useAdminUnlock(): AdminUnlockState {
  const snapshot = useSyncExternalStore(
    subscribe,
    readClientSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const unlock = useCallback((next: string) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore - keep in-memory only.
    }
    notifyLocal();
  }, []);

  const lock = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore.
    }
    notifyLocal();
  }, []);

  return {
    code: snapshot.code,
    hydrated: snapshot.hydrated,
    isUnlocked: snapshot.hydrated && snapshot.code !== null,
    unlock,
    lock,
  };
}
