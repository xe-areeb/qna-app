import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";

/**
 * MVP admin gate for Convex functions.
 *
 * The gate is intentionally simple: a single shared secret read from the
 * Convex environment variable `ADMIN_ACCESS_CODE`. Set it once per
 * deployment with:
 *
 * ```bash
 * npx convex env set ADMIN_ACCESS_CODE <your-code>
 * ```
 *
 * Every "dangerous" public mutation (and the analytics queries) requires
 * an `adminCode` argument that we compare against the configured secret
 * via {@link assertAdmin}. The frontend stores the code in `sessionStorage`
 * after a one-time unlock at `/admin`.
 *
 * **This is NOT final auth.** It's a deliberately small gate suitable for an
 * MVP / client demo. It cannot distinguish between admins, can't be revoked
 * per-user, and offers no audit trail. Replace with Convex Auth + role
 * check before any real public deployment.
 */

/**
 * Throws a `ConvexError` if:
 *   - `ADMIN_ACCESS_CODE` is not set on the Convex deployment, or
 *   - the supplied `adminCode` does not match.
 *
 * Otherwise returns silently. Call this at the **top** of every protected
 * mutation/query handler before reading or writing data.
 */
export function assertAdmin(adminCode: string | undefined): void {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) {
    throw new ConvexError(
      "Admin access is not configured on the server. " +
        "Run `npx convex env set ADMIN_ACCESS_CODE <code>` and reload the admin page.",
    );
  }
  if (!adminCode || adminCode !== expected) {
    throw new ConvexError("Invalid admin access code.");
  }
}

/**
 * One-shot endpoint used by `/admin` to validate a code before the UI
 * stores it in `sessionStorage`. Throws on any failure (unset on the
 * server, or mismatch). Returns `{ ok: true }` on success.
 */
export const verifyAdminCode = mutationGeneric({
  args: { adminCode: v.string() },
  handler: async (_ctx, args) => {
    assertAdmin(args.adminCode);
    return { ok: true as const };
  },
});

/**
 * Public, side-effect-free probe so the UI can say "admin access isn't
 * configured on the server yet" instead of letting the unlock form fail
 * with a confusing error. Does **not** leak the code itself.
 */
export const isAdminConfigured = queryGeneric({
  args: {},
  handler: async () => {
    return Boolean(process.env.ADMIN_ACCESS_CODE);
  },
});
