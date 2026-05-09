import type { NextConfig } from "next";

/**
 * Cloudflare Pages deployment uses Next.js' static export.
 *
 * Why static export:
 *   - Every route in this app prerenders cleanly (verified via `next build`
 *     output: all routes show as `○ (Static)`).
 *   - All data fetching happens client-side through the Convex React client
 *     (`useQuery` / `useMutation`). There are no server actions, route
 *     handlers, server-only data fetches, image optimization needs, or
 *     dynamic route params.
 *   - That means the Cloudflare adapter (`@opennextjs/cloudflare`) is not
 *     needed - a plain static export deployed to Cloudflare Pages is the
 *     simplest, most stable path.
 *
 * `images.unoptimized: true` is set defensively so any future `next/image`
 * usage continues to work under static export (no Next image optimizer is
 * available off-server).
 *
 * If we ever introduce server-only features (server actions, route
 * handlers, ISR, dynamic SSR), revisit this config and switch to
 * `@opennextjs/cloudflare` instead.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
