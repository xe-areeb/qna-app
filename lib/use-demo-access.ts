"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "qna:demo-access-unlocked";
const UNLOCKED_VALUE = "true";

type Snapshot = { hydrated: boolean; isUnlocked: boolean };

const SERVER_SNAPSHOT: Snapshot = { hydrated: false, isUnlocked: false };
let clientSnapshot: Snapshot = { hydrated: true, isUnlocked: false };
const localSubscribers = new Set<() => void>();

function readClientSnapshot(): Snapshot {
  let isUnlocked = false;
  try {
    isUnlocked =
      window.sessionStorage.getItem(STORAGE_KEY) === UNLOCKED_VALUE;
  } catch {
    isUnlocked = false;
  }

  if (clientSnapshot.isUnlocked !== isUnlocked) {
    clientSnapshot = { hydrated: true, isUnlocked };
  }
  return clientSnapshot;
}

function subscribe(callback: () => void): () => void {
  localSubscribers.add(callback);
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

export function useDemoAccess() {
  const snapshot = useSyncExternalStore(
    subscribe,
    readClientSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const unlock = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, UNLOCKED_VALUE);
    } catch {
      // If sessionStorage is unavailable, keep the user on the access screen.
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
    hydrated: snapshot.hydrated,
    isUnlocked: snapshot.isUnlocked,
    unlock,
    lock,
  };
}
