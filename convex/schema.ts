import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * EventPulse schema - event-scoped quiz leaderboard.
 *
 * NOTE: Visitor and admin auth are deferred. Visitor identity is captured via
 * `visitorIdentifier` (e.g. a client-generated id) plus a chosen `visitorName`.
 * Admin mutations remain open here; access control is a TODO before production.
 */
export default defineSchema({
  events: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  questions: defineTable({
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswerIndex: v.number(),
    order: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_active", ["eventId", "isActive"]),

  quizSessions: defineTable({
    eventId: v.id("events"),
    visitorName: v.string(),
    /** Stable per-visitor identifier (e.g. localStorage uuid) - replaces auth id for now. */
    visitorIdentifier: v.string(),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    totalQuestions: v.optional(v.number()),
    percentage: v.optional(v.number()),
    rating: v.optional(v.string()),
    timeTaken: v.optional(v.number()),
  })
    .index("by_event", ["eventId"])
    .index("by_event_status", ["eventId", "status"])
    .index("by_event_visitor", ["eventId", "visitorIdentifier"]),

  answers: defineTable({
    eventId: v.id("events"),
    sessionId: v.id("quizSessions"),
    questionId: v.id("questions"),
    selectedAnswerIndex: v.number(),
    isCorrect: v.boolean(),
    answeredAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_session", ["sessionId"])
    .index("by_question", ["questionId"])
    .index("by_session_question", ["sessionId", "questionId"]),
});
