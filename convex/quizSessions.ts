import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";

/**
 * Quiz sessions are scoped to an event. One visitor (identified today by
 * `visitorIdentifier` — a deterministic string the client builds from
 * `eventId + normalized name`) may complete only one session per event.
 */

/**
 * Rating bands by final percentage.
 *
 * | Range | Rating |
 * |-------|--------|
 * | 90–100 | Champion |
 * | 75–89  | Excellent |
 * | 50–74  | Good |
 * | <50    | Try Again |
 */
function ratingFor(percentage: number): string {
  if (percentage >= 90) return "Champion";
  if (percentage >= 75) return "Excellent";
  if (percentage >= 50) return "Good";
  return "Try Again";
}

/**
 * Start (or resume) a quiz session for `(eventId, visitorIdentifier)`.
 *
 * Returns `{ sessionId, status }`:
 *   - existing in-progress  → resume
 *   - existing completed    → caller should redirect to results
 *   - none                  → new in-progress session is created
 */
export const createQuizSession = mutationGeneric({
  args: {
    eventId: v.id("events"),
    visitorName: v.string(),
    visitorIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const eventRows = await ctx.db
      .query("quizSessions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const existing = eventRows.find(
      (row) => row.visitorIdentifier === args.visitorIdentifier,
    );
    if (existing) {
      return {
        sessionId: existing._id,
        status: existing.status as "in_progress" | "completed",
      };
    }
    const sessionId = await ctx.db.insert("quizSessions", {
      eventId: args.eventId,
      visitorName: args.visitorName,
      visitorIdentifier: args.visitorIdentifier,
      status: "in_progress",
      startedAt: Date.now(),
    });
    return { sessionId, status: "in_progress" as const };
  },
});

/**
 * Finalize a session: tally correct answers, derive percentage / rating,
 * stamp `completedAt` and `timeTaken`. Idempotent — calling on an already
 * completed session returns its stored values without modification.
 */
export const completeQuizSession = mutationGeneric({
  args: {
    eventId: v.id("events"),
    sessionId: v.id("quizSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found.");
    }
    if (session.eventId !== args.eventId) {
      throw new ConvexError("Session does not belong to this event.");
    }
    if (session.status === "completed") {
      return {
        sessionId: session._id,
        status: "completed" as const,
        score: session.score ?? 0,
        totalQuestions: session.totalQuestions ?? 0,
        percentage: session.percentage ?? 0,
        rating: session.rating ?? "Try Again",
        timeTaken: session.timeTaken ?? 0,
      };
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const eventQuestions = await ctx.db
      .query("questions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const totalQuestions = eventQuestions.filter((q) => q.isActive).length;

    const score = answers.filter((a) => a.isCorrect === true).length;
    const percentage =
      totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const rating = ratingFor(percentage);
    const completedAt = Date.now();
    const timeTaken = Math.max(0, completedAt - session.startedAt);

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt,
      score,
      totalQuestions,
      percentage,
      rating,
      timeTaken,
    });

    return {
      sessionId: session._id,
      status: "completed" as const,
      score,
      totalQuestions,
      percentage,
      rating,
      timeTaken,
    };
  },
});

/**
 * Per-event leaderboard: completed sessions, sort score DESC then time ASC.
 *
 * `eventId` is optional only to keep existing UI placeholders working. Passing
 * `null`/omitting it returns an empty list. **TODO**: make `eventId` required
 * once the UI always selects an event.
 */
export const getLeaderboard = queryGeneric({
  args: {
    eventId: v.optional(v.id("events")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.eventId) {
      return [];
    }
    const limit = Math.min(args.limit ?? 50, 200);
    const eventId = args.eventId;
    const rows = await ctx.db
      .query("quizSessions")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    const sorted = rows
      .filter((row) => row.status === "completed")
      .sort((a, b) => {
        const sa = a.score ?? 0;
        const sb = b.score ?? 0;
        if (sb !== sa) return sb - sa;
        const ta = a.timeTaken ?? Number.POSITIVE_INFINITY;
        const tb = b.timeTaken ?? Number.POSITIVE_INFINITY;
        return ta - tb;
      });

    return sorted.slice(0, limit);
  },
});

/**
 * Read a quiz session as a result document. Works for both in-progress and
 * completed sessions; score/rating/etc. are `undefined` until the quiz is
 * finalized.
 */
export const getQuizResult = queryGeneric({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      eventId: session.eventId,
      visitorName: session.visitorName,
      status: session.status as "in_progress" | "completed",
      score: session.score,
      totalQuestions: session.totalQuestions,
      percentage: session.percentage,
      rating: session.rating,
      timeTaken: session.timeTaken,
      completedAt: session.completedAt,
    };
  },
});

/**
 * Number of answers already submitted for a session. Drives quiz progress and
 * resumption — the next question to show is the one at `answeredCount` in the
 * ordered active question list.
 */
export const getSessionAnsweredCount = queryGeneric({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("answers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return rows.length;
  },
});

/**
 * Compute a 1-based rank for a completed session inside its event's
 * leaderboard (score DESC, timeTaken ASC).
 *
 * Returns `null` if the session is missing or not yet completed. Otherwise
 * returns `{ rank, total }` where `total` is the number of completed sessions
 * for the event.
 *
 * Implementation reuses the same ordering as `getLeaderboard` so rank shown
 * to a visitor matches the leaderboard they see.
 */
export const getSessionRank = queryGeneric({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (session.status !== "completed") return null;

    const rows = await ctx.db
      .query("quizSessions")
      .withIndex("by_event", (q) => q.eq("eventId", session.eventId))
      .collect();

    const sorted = rows
      .filter((row) => row.status === "completed")
      .sort((a, b) => {
        const sa = a.score ?? 0;
        const sb = b.score ?? 0;
        if (sb !== sa) return sb - sa;
        const ta = a.timeTaken ?? Number.POSITIVE_INFINITY;
        const tb = b.timeTaken ?? Number.POSITIVE_INFINITY;
        return ta - tb;
      });

    const idx = sorted.findIndex((row) => row._id === session._id);
    if (idx < 0) return null;
    return { rank: idx + 1, total: sorted.length };
  },
});
