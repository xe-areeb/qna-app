"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";

/** Allows SSR/build when env is unset; replace at runtime via `NEXT_PUBLIC_CONVEX_URL`. */
const FALLBACK_CONVEX_URL = "https://placeholder.convex.cloud";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? FALLBACK_CONVEX_URL;
  const client = useMemo(() => new ConvexReactClient(url), [url]);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
