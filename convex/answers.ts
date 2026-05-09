import { mutationGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";

/**
 * Record a visitor's answer for one question within a session.
 *
 * Server-side validation:
 *   - session exists
 *   - question exists
 *   - session and question belong to the same event
 *   - selectedAnswerIndex is within the question's option range
 *   - the same (sessionId, questionId) has not already been answered
 *
 * NOTE: `isCorrect` is computed server-side and stored, but the **frontend
 * must not display correctness mid-quiz** — the result is only revealed on
 * the results page after `completeQuizSession`.
 */
export const submitAnswer = mutationGeneric({
  args: {
    eventId: v.id("events"),
    sessionId: v.id("quizSessions"),
    questionId: v.id("questions"),
    selectedAnswerIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found.");
    }
    if (session.eventId !== args.eventId) {
      throw new ConvexError("Session does not belong to this event.");
    }
    if (session.status !== "in_progress") {
      throw new ConvexError(
        "This session is already completed — no further answers accepted.",
      );
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new ConvexError("Question not found.");
    }
    if (question.eventId !== args.eventId) {
      throw new ConvexError("Question does not belong to this event.");
    }
    if (
      typeof args.selectedAnswerIndex !== "number" ||
      !Number.isInteger(args.selectedAnswerIndex) ||
      args.selectedAnswerIndex < 0 ||
      args.selectedAnswerIndex >= question.options.length
    ) {
      throw new ConvexError("Selected answer index is out of range.");
    }

    const sessionAnswers = await ctx.db
      .query("answers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    if (sessionAnswers.some((row) => row.questionId === args.questionId)) {
      throw new ConvexError("This question was already answered.");
    }

    const isCorrect =
      args.selectedAnswerIndex === question.correctAnswerIndex;
    const answerId = await ctx.db.insert("answers", {
      eventId: args.eventId,
      sessionId: args.sessionId,
      questionId: args.questionId,
      selectedAnswerIndex: args.selectedAnswerIndex,
      isCorrect,
      answeredAt: Date.now(),
    });

    return { answerId, isCorrect };
  },
});
