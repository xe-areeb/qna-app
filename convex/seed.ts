import { mutationGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertAdmin } from "./adminAuth";

/**
 * Seed data for local development.
 *
 * `seedDemoEvent` is **idempotent**:
 *   - If an event with slug `demo-event` exists, it is reused (not duplicated).
 *   - Questions are upserted by `(eventId, order)` — existing orders are skipped.
 *
 * TODO(auth): seeding is open right now. Lock down before any deployment that
 * exposes this mutation. TODO: switch question delete to a soft archive once
 * historical answers/sessions need preservation.
 */

const DEMO_EVENT_SLUG = "demo-event";
const DEMO_EVENT_TITLE = "Demo Quiz Event";
const DEMO_EVENT_DESCRIPTION =
  "Demo event seeded for local development. Safe to reseed — call seedDemoEvent multiple times.";

type DemoQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
};

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    question: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    correctAnswerIndex: 2,
  },
  {
    question: "Which planet is the largest in our solar system?",
    options: ["Earth", "Jupiter", "Mars", "Saturn"],
    correctAnswerIndex: 1,
  },
  {
    question: "How many continents are there on Earth?",
    options: ["5", "6", "7", "8"],
    correctAnswerIndex: 2,
  },
  {
    question: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    correctAnswerIndex: 2,
  },
  {
    question: "Which element has the chemical symbol \"O\"?",
    options: ["Gold", "Oxygen", "Osmium", "Hydrogen"],
    correctAnswerIndex: 1,
  },
  {
    question: "Who wrote Romeo and Juliet?",
    options: [
      "Ernest Hemingway",
      "William Shakespeare",
      "Charles Dickens",
      "Mark Twain",
    ],
    correctAnswerIndex: 1,
  },
  {
    question: "In what year did World War II end?",
    options: ["1939", "1942", "1945", "1948"],
    correctAnswerIndex: 2,
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Pablo Picasso", "Vincent van Gogh", "Leonardo da Vinci", "Claude Monet"],
    correctAnswerIndex: 2,
  },
  {
    question: "H2O is the chemical formula for what?",
    options: ["Salt", "Water", "Ozone", "Hydrogen peroxide"],
    correctAnswerIndex: 1,
  },
  {
    question: "Approximately what is the speed of light in metres per second?",
    options: ["300", "3,000", "300,000", "300,000,000"],
    correctAnswerIndex: 3,
  },
  {
    question: "Which is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctAnswerIndex: 3,
  },
  {
    question: "Which programming language was created by Guido van Rossum?",
    options: ["Java", "Python", "Ruby", "JavaScript"],
    correctAnswerIndex: 1,
  },
  {
    question: "Who developed the theory of relativity?",
    options: ["Isaac Newton", "Albert Einstein", "Nikola Tesla", "Stephen Hawking"],
    correctAnswerIndex: 1,
  },
  {
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "13"],
    correctAnswerIndex: 2,
  },
  {
    question: "What does \"CPU\" stand for?",
    options: [
      "Central Programming Unit",
      "Computer Processing Unit",
      "Central Processing Unit",
      "Computer Personal Unit",
    ],
    correctAnswerIndex: 2,
  },
];

/**
 * Wipe all visitor attempts for the demo event without touching the event
 * itself or its questions. Useful before a client demo or local QA pass.
 *
 * Deletes:
 *   - every `quizSessions` row scoped to the demo event
 *   - every `answers` row scoped to the demo event
 *
 * Preserves:
 *   - the `events` row for `demo-event`
 *   - all `questions` for that event (active and inactive)
 *
 * Returns `{ deletedSessions, deletedAnswers, eventFound }`. `eventFound` is
 * `false` when the demo event hasn't been seeded yet — both counters are `0`
 * in that case (the call is a graceful no-op rather than an error).
 *
 * TODO(auth): public today like the rest of the admin surface. Lock down
 * before any deployment.
 */
export const resetDemoEventResponses = mutationGeneric({
  args: { adminCode: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", DEMO_EVENT_SLUG))
      .unique();

    if (!event) {
      return {
        deletedSessions: 0,
        deletedAnswers: 0,
        eventFound: false as const,
      };
    }

    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    for (const row of sessions) {
      await ctx.db.delete(row._id);
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    for (const row of answers) {
      await ctx.db.delete(row._id);
    }

    return {
      deletedSessions: sessions.length,
      deletedAnswers: answers.length,
      eventFound: true as const,
    };
  },
});

export const seedDemoEvent = mutationGeneric({
  args: { adminCode: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.adminCode);

    if (DEMO_QUESTIONS.length !== 15) {
      throw new ConvexError(
        `seedDemoEvent expects 15 demo questions, found ${DEMO_QUESTIONS.length}.`,
      );
    }

    const now = Date.now();

    const existingEvent = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", DEMO_EVENT_SLUG))
      .unique();

    let createdEvent = false;
    let eventId;
    if (existingEvent) {
      eventId = existingEvent._id;
    } else {
      eventId = await ctx.db.insert("events", {
        title: DEMO_EVENT_TITLE,
        slug: DEMO_EVENT_SLUG,
        description: DEMO_EVENT_DESCRIPTION,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      createdEvent = true;
    }

    const existingQuestions = await ctx.db
      .query("questions")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    const takenOrders = new Set<number>();
    for (const row of existingQuestions) takenOrders.add(row.order);

    let createdQuestions = 0;
    for (let i = 0; i < DEMO_QUESTIONS.length; i++) {
      const order = i + 1;
      if (takenOrders.has(order)) continue;
      const dq = DEMO_QUESTIONS[i];
      await ctx.db.insert("questions", {
        eventId,
        question: dq.question,
        options: dq.options,
        correctAnswerIndex: dq.correctAnswerIndex,
        order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      createdQuestions++;
    }

    return {
      eventId,
      createdEvent,
      createdQuestions,
      existingQuestions: existingQuestions.length,
    };
  },
});
