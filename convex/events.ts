import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertAdmin } from "./adminAuth";

/**
 * Event management — basic stubs.
 *
 * Admin mutations are gated by the MVP `adminCode` shared secret (see
 * `convex/adminAuth.ts`). They still need a follow-up pass to use Convex
 * Auth + per-user role checks before a real production deployment.
 */

/**
 * List events. Optional `status` filter (draft | active | archived).
 */
export const listEvents = queryGeneric({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("events")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }
    return await ctx.db.query("events").collect();
  },
});

/**
 * Look up an active event by slug — used by visitor-facing routes.
 */
export const getActiveEventBySlug = queryGeneric({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!event || event.status !== "active") return null;
    return event;
  },
});

/**
 * Admin: create an event. Gated by the shared MVP admin code.
 */
export const adminCreateEvent = mutationGeneric({
  args: {
    adminCode: v.string(),
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("archived"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new ConvexError(`Slug "${args.slug}" is already in use.`);
    }
    const now = Date.now();
    return await ctx.db.insert("events", {
      title: args.title,
      slug: args.slug,
      description: args.description,
      status: args.status ?? "draft",
      startDate: args.startDate,
      endDate: args.endDate,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Admin: update an event. Gated by the shared MVP admin code.
 */
export const adminUpdateEvent = mutationGeneric({
  args: {
    adminCode: v.string(),
    id: v.id("events"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("archived"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.slug !== undefined) patch.slug = args.slug;
    if (args.description !== undefined) patch.description = args.description;
    if (args.status !== undefined) patch.status = args.status;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    patch.updatedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Admin: archive an event (soft delete). Gated by the shared MVP admin code.
 */
export const adminArchiveEvent = mutationGeneric({
  args: { adminCode: v.string(), id: v.id("events") },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});
