import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./adminAuth";

/**
 * Per-event analytics queries. These are read-only aggregations over
 * `quizSessions` and `answers` for the supplied `eventId`.
 *
 * Both queries are gated by the MVP `adminCode` shared secret (see
 * `convex/adminAuth.ts`). They will be migrated to a proper auth + role
 * check once Convex Auth lands.
 *
 * Computation strategy: read all relevant rows for the event and aggregate
 * in-memory. Demo events have ≤ 15 questions and a small number of completed
 * sessions, so this is comfortable. If volumes grow we can swap to running
 * aggregates (denormalized counters or scheduled functions).
 */

/**
 * Top-level event totals for the analytics dashboard.
 *
 * Returns:
 *   - `totalCompleted`: number of completed sessions.
 *   - `totalInProgress`: number of in-progress sessions (visitors who started
 *     but haven't finished).
 *   - `averageScore` / `averagePercentage`: across completed sessions, or
 *     `null` when no completed sessions exist yet.
 *   - `highestScore`: max raw score, or `null`.
 *   - `fastestTime`: fastest `timeTaken` among the **highest-scoring** group
 *     (matches leaderboard tie-break ordering), or `null`.
 *   - `totalActiveQuestions`: number of active questions for the event.
 */
export const getEventAnalytics = queryGeneric({
  args: { adminCode: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const completed = sessions.filter((s) => s.status === "completed");
    const totalInProgress = sessions.length - completed.length;

    const scores = completed
      .map((s) => s.score)
      .filter((n): n is number => typeof n === "number");
    const percentages = completed
      .map((s) => s.percentage)
      .filter((n): n is number => typeof n === "number");

    const totalCompleted = completed.length;
    const averageScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
    const averagePercentage =
      percentages.length > 0
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : null;
    const highestScore = scores.length > 0 ? Math.max(...scores) : null;

    let fastestTime: number | null = null;
    if (highestScore !== null) {
      const topScorers = completed.filter((s) => (s.score ?? 0) === highestScore);
      const times = topScorers
        .map((s) => s.timeTaken)
        .filter((n): n is number => typeof n === "number");
      fastestTime = times.length > 0 ? Math.min(...times) : null;
    }

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const totalActiveQuestions = questions.filter((q) => q.isActive).length;

    return {
      totalCompleted,
      totalInProgress,
      averageScore,
      averagePercentage,
      highestScore,
      fastestTime,
      totalActiveQuestions,
    };
  },
});

/**
 * Per-question stats for the event's active questions.
 *
 * For each active question:
 *   - `totalAnswers`: how many answers have been recorded.
 *   - `correctCount`: how many were correct.
 *   - `correctPercentage`: rounded percent correct (0–100), or `null` if no
 *     answers yet.
 *
 * Sorted by question `order` ascending.
 */
export const getQuestionAnalytics = queryGeneric({
  args: { adminCode: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const activeQuestions = questions
      .filter((q) => q.isActive)
      .sort((a, b) => a.order - b.order);

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return activeQuestions.map((q) => {
      const qAnswers = answers.filter((a) => a.questionId === q._id);
      const totalAnswers = qAnswers.length;
      const correctCount = qAnswers.filter((a) => a.isCorrect).length;
      const correctPercentage =
        totalAnswers > 0
          ? Math.round((correctCount / totalAnswers) * 100)
          : null;
      return {
        questionId: q._id,
        order: q.order,
        question: q.question,
        totalAnswers,
        correctCount,
        correctPercentage,
      };
    });
  },
});
