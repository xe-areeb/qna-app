import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertAdmin } from "./adminAuth";

/**
 * Questions are now event-scoped. Each question belongs to exactly one event.
 *
 * Admin mutations are gated by the MVP `adminCode` shared secret (see
 * `convex/adminAuth.ts`). Replace with proper Convex Auth + role checks
 * before a real deployment.
 */

/**
 * List active questions for an event, ordered ascending by `order`.
 *
 * `eventId` is required to keep questions scoped to a single event. Backwards
 * compatibility note: pre-event scaffolding accepted no args; callers must now
 * pass `eventId`.
 */
export const listActiveQuestions = queryGeneric({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return rows
      .filter((row) => row.isActive === true)
      .sort((a, b) => a.order - b.order);
  },
});

/**
 * Admin: create a question for an event. Gated by the shared MVP admin code.
 */
export const adminCreateQuestion = mutationGeneric({
  args: {
    adminCode: v.string(),
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswerIndex: v.number(),
    order: v.number(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    if (args.options.length !== 4) {
      throw new ConvexError("Each question must have exactly 4 options.");
    }
    if (args.correctAnswerIndex < 0 || args.correctAnswerIndex > 3) {
      throw new ConvexError("correctAnswerIndex must be between 0 and 3.");
    }
    const now = Date.now();
    return await ctx.db.insert("questions", {
      eventId: args.eventId,
      question: args.question,
      options: args.options,
      correctAnswerIndex: args.correctAnswerIndex,
      order: args.order,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Admin: update a question. `eventId` cannot be changed here; create a new
 * question under the target event instead. Gated by the shared MVP admin code.
 */
export const adminUpdateQuestion = mutationGeneric({
  args: {
    adminCode: v.string(),
    id: v.id("questions"),
    question: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswerIndex: v.optional(v.number()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    if (args.options !== undefined && args.options.length !== 4) {
      throw new ConvexError("Each question must have exactly 4 options.");
    }
    if (
      args.correctAnswerIndex !== undefined &&
      (args.correctAnswerIndex < 0 || args.correctAnswerIndex > 3)
    ) {
      throw new ConvexError("correctAnswerIndex must be between 0 and 3.");
    }
    const patch: Record<string, unknown> = {};
    if (args.question !== undefined) patch.question = args.question;
    if (args.options !== undefined) patch.options = args.options;
    if (args.correctAnswerIndex !== undefined) {
      patch.correctAnswerIndex = args.correctAnswerIndex;
    }
    if (args.order !== undefined) patch.order = args.order;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    patch.updatedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Admin: delete a question. Gated by the shared MVP admin code.
 */
export const adminDeleteQuestion = mutationGeneric({
  args: { adminCode: v.string(), id: v.id("questions") },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    await ctx.db.delete(args.id);
  },
});
