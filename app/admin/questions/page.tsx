"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageShell } from "@/components/page-shell";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { ErrorPlaceholder } from "@/components/error-placeholder";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { AdminGate } from "@/components/admin-gate";

/**
 * Admin: manage events' questions.
 *
 * Wrapped in `AdminGate`, so the inner page only renders once the visitor
 * has unlocked at `/admin`. The unlocked `adminCode` is threaded into every
 * protected mutation call (seed, create, **edit**, delete, reset).
 *
 * Capabilities today:
 *   - Seed a demo event + 15 questions via `seedDemoEvent` (idempotent).
 *   - Pick an event from `listEvents`.
 *   - Show **active** questions for the picked event via `listActiveQuestions`.
 *   - Create a question via `adminCreateQuestion`.
 *   - **Edit a question in place** via `adminUpdateQuestion` (one row at a
 *     time; other rows' Edit/Delete buttons are disabled while a row is
 *     being edited). The form preserves `eventId` automatically because the
 *     server-side mutation never accepts/changes that field.
 *   - Hard delete a question via `adminDeleteQuestion`.
 *
 * TODO: question **reorder** UI (drag/drop or simple up/down) — would call
 * `adminUpdateQuestion({ order })` for the swapped rows.
 * TODO: an admin-only "list all questions" query so inactive questions are
 * visible here too. `listActiveQuestions` only returns `isActive === true`.
 * TODO: switch hard delete to soft archive (e.g. flip `isActive`) so historical
 * answers/sessions aren't orphaned in the future.
 * TODO(auth): MVP shared-code gate only — replace with Convex Auth + role
 * checks before deployment.
 */

type EventStatus = "draft" | "active" | "archived";

type EventDoc = {
  _id: Id<"events">;
  title: string;
  slug: string;
  status: EventStatus;
};

type QuestionDoc = {
  _id: Id<"questions">;
  eventId: Id<"events">;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  order: number;
  isActive: boolean;
};

type SeedResult = {
  eventId: Id<"events">;
  createdEvent: boolean;
  createdQuestions: number;
  existingQuestions: number;
};

type SeedStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; result: SeedResult }
  | { state: "error"; message: string };

export default function AdminQuestionsPage() {
  return (
    <AdminGate>
      {({ adminCode }) => <AdminQuestionsInner adminCode={adminCode} />}
    </AdminGate>
  );
}

function AdminQuestionsInner({ adminCode }: { adminCode: string }) {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const events = useQuery(
    api.events.listEvents,
    hasUrl ? {} : "skip",
  ) as EventDoc[] | undefined;

  // `pickedEventId` is what the admin explicitly chose; `selectedEventId` is
  // the derived effective id (picked, else first active, else first event).
  // Computing it lets us avoid setState-in-effect.
  const [pickedEventId, setPickedEventId] = useState<Id<"events"> | null>(null);

  const selectedEventId = useMemo<Id<"events"> | null>(() => {
    if (!events || events.length === 0) return null;
    if (pickedEventId && events.some((e) => e._id === pickedEventId)) {
      return pickedEventId;
    }
    const firstActive = events.find((e) => e.status === "active") ?? events[0];
    return firstActive._id;
  }, [events, pickedEventId]);

  const questions = useQuery(
    api.questions.listActiveQuestions,
    hasUrl && selectedEventId ? { eventId: selectedEventId } : "skip",
  ) as QuestionDoc[] | undefined;

  const selectedEvent = useMemo(
    () => events?.find((e) => e._id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const seedDemo = useMutation(api.seed.seedDemoEvent);
  const createQuestion = useMutation(api.questions.adminCreateQuestion);
  const updateQuestion = useMutation(api.questions.adminUpdateQuestion);
  const deleteQuestion = useMutation(api.questions.adminDeleteQuestion);

  const [seedStatus, setSeedStatus] = useState<SeedStatus>({ state: "idle" });
  // Only one question can be in edit mode at a time. `null` = no row open.
  const [editingId, setEditingId] = useState<Id<"questions"> | null>(null);

  async function handleSeed() {
    setSeedStatus({ state: "loading" });
    try {
      const result = (await seedDemo({ adminCode })) as SeedResult;
      setSeedStatus({ state: "ok", result });
      setPickedEventId(result.eventId);
    } catch (e) {
      setSeedStatus({
        state: "error",
        message: e instanceof Error ? e.message : "Seed failed.",
      });
    }
  }

  if (!hasUrl) {
    return (
      <PageShell title="Manage questions">
        <ErrorPlaceholder title="Convex URL not configured">
          Run <code className="font-mono text-xs">npm run convex:dev</code> and set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
          <code className="font-mono text-xs">.env.local</code>, then reload.
        </ErrorPlaceholder>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Manage questions"
      description="Per-event question CRUD. Gated by the MVP admin code — proper Convex Auth comes later."
    >
      <EventBar
        events={events}
        selectedEventId={selectedEventId}
        onSelect={setPickedEventId}
        onSeed={handleSeed}
        seedStatus={seedStatus}
      />

      {selectedEvent ? <SelectedEventHeader event={selectedEvent} /> : null}

      <QuestionList
        eventSelected={Boolean(selectedEvent)}
        questions={questions}
        editingId={editingId}
        onStartEdit={(id) => setEditingId(id)}
        onCancelEdit={() => setEditingId(null)}
        onUpdate={async (id, values) => {
          await updateQuestion({
            adminCode,
            id,
            question: values.question,
            options: values.options,
            correctAnswerIndex: values.correctAnswerIndex,
            order: values.order,
            isActive: values.isActive,
          });
          // Exit edit mode only on success — errors stay inline in the form.
          setEditingId(null);
        }}
        onDelete={async (id) => {
          if (
            typeof window !== "undefined" &&
            !window.confirm(
              "Delete this question? This is a hard delete for now.",
            )
          ) {
            return;
          }
          await deleteQuestion({ adminCode, id });
        }}
      />

      {selectedEvent ? (
        <CreateQuestionForm
          eventId={selectedEvent._id}
          nextOrder={(questions?.length ?? 0) + 1}
          onSubmit={async (values) => {
            await createQuestion({ adminCode, ...values });
          }}
        />
      ) : null}

      <ResetDemoButton adminCode={adminCode} />

      <p className="text-xs text-amber-700 dark:text-amber-300">
        Heads up: <code className="font-mono">adminDeleteQuestion</code> hard-deletes
        today. TODO: switch to soft archive (flip <code className="font-mono">isActive</code>)
        once historical answers/sessions matter.
      </p>
    </PageShell>
  );
}

function EventBar({
  events,
  selectedEventId,
  onSelect,
  onSeed,
  seedStatus,
}: {
  events: EventDoc[] | undefined;
  selectedEventId: Id<"events"> | null;
  onSelect: (id: Id<"events">) => void;
  onSeed: () => void;
  seedStatus: SeedStatus;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1 min-w-[220px]">
          <label
            htmlFor="event-picker"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Event
          </label>
          {events === undefined ? (
            <LoadingPlaceholder label="Loading events…" />
          ) : events.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No events yet. Use <strong>Seed demo event</strong> to create one.
            </p>
          ) : (
            <select
              id="event-picker"
              value={selectedEventId ?? ""}
              onChange={(e) => onSelect(e.target.value as Id<"events">)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.title} · {event.status}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={onSeed}
          disabled={seedStatus.state === "loading"}
          className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {seedStatus.state === "loading" ? "Seeding…" : "Seed demo event"}
        </button>
      </div>

      {seedStatus.state === "ok" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          Seed complete · event {seedStatus.result.createdEvent ? "created" : "reused"} ·
          {" "}
          {seedStatus.result.createdQuestions} new question(s),
          {" "}
          {seedStatus.result.existingQuestions} already present.
        </div>
      ) : null}
      {seedStatus.state === "error" ? (
        <ErrorPlaceholder title="Seed failed">{seedStatus.message}</ErrorPlaceholder>
      ) : null}
    </section>
  );
}

function SelectedEventHeader({ event }: { event: EventDoc }) {
  const statusClass =
    event.status === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
      : event.status === "draft"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

  return (
    <section className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {event.title}
      </h2>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${statusClass}`}
      >
        {event.status}
      </span>
      <code className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {event.slug}
      </code>
    </section>
  );
}

type QuestionEditValues = {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  order: number;
  isActive: boolean;
};

function QuestionList({
  eventSelected,
  questions,
  editingId,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  eventSelected: boolean;
  questions: QuestionDoc[] | undefined;
  editingId: Id<"questions"> | null;
  onStartEdit: (id: Id<"questions">) => void;
  onCancelEdit: () => void;
  onUpdate: (id: Id<"questions">, values: QuestionEditValues) => Promise<void>;
  onDelete: (id: Id<"questions">) => Promise<void>;
}) {
  if (!eventSelected) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Select or seed an event to view its questions.
      </p>
    );
  }
  if (questions === undefined) {
    return <LoadingPlaceholder label="Loading questions…" />;
  }
  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        No active questions for this event yet. Use the form below to add one,
        or seed the demo event.
      </div>
    );
  }
  // Disable Edit/Delete on every other row while one row is in edit mode —
  // keeps the data model and undo story simple (one outstanding draft).
  const otherRowEditing = (id: Id<"questions">) =>
    editingId !== null && editingId !== id;

  return (
    <ul className="space-y-3">
      {questions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((q) => (
          <li
            key={q._id}
            className={`rounded-2xl border bg-white p-4 dark:bg-zinc-900/40 ${
              editingId === q._id
                ? "border-emerald-300 ring-1 ring-emerald-300/60 dark:border-emerald-800/60 dark:ring-emerald-800/60"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {editingId === q._id ? (
              <EditQuestionForm
                initial={q}
                onCancel={onCancelEdit}
                onSubmit={(values) => onUpdate(q._id, values)}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">#{q.order}</span>
                    {q.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-base font-medium text-zinc-900 dark:text-zinc-50">
                    {q.question}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((opt, i) => (
                      <li
                        key={i}
                        className={
                          i === q.correctAnswerIndex
                            ? "font-semibold text-emerald-700 dark:text-emerald-400"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        <span className="mr-2 font-mono text-xs text-zinc-400">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                        {i === q.correctAnswerIndex ? " ✓" : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onStartEdit(q._id)}
                    disabled={otherRowEditing(q._id)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(q._id)}
                    disabled={otherRowEditing(q._id)}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
    </ul>
  );
}

function CreateQuestionForm({
  eventId,
  nextOrder,
  onSubmit,
}: {
  eventId: Id<"events">;
  nextOrder: number;
  onSubmit: (values: {
    eventId: Id<"events">;
    question: string;
    options: string[];
    correctAnswerIndex: number;
    order: number;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0);
  // `null` means "use the next-available default"; user input flips it to a number.
  const [orderInput, setOrderInput] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = orderInput ?? nextOrder;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim());
    if (!trimmedQuestion) {
      setError("Question text is required.");
      return;
    }
    if (trimmedOptions.some((o) => o === "")) {
      setError("All four options are required.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        eventId,
        question: trimmedQuestion,
        options: trimmedOptions,
        correctAnswerIndex,
        order,
        isActive,
      });
      setQuestion("");
      setOptions(["", "", "", ""]);
      setCorrectAnswerIndex(0);
      setIsActive(true);
      setOrderInput(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Add question
      </h3>

      <div>
        <label
          htmlFor="question-text"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Question
        </label>
        <input
          id="question-text"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Options (mark the correct one)
        </legend>
        {options.map((opt, i) => (
          <label
            key={i}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <input
              type="radio"
              name="correctAnswerIndex"
              checked={correctAnswerIndex === i}
              onChange={() => setCorrectAnswerIndex(i)}
              aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
            />
            <span className="font-mono text-xs text-zinc-500">
              {String.fromCharCode(65 + i)}.
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const next = options.slice();
                next[i] = e.target.value;
                setOptions(next);
              }}
              required
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 focus:outline-none dark:text-zinc-50"
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          Order
          <input
            type="number"
            min={1}
            value={order}
            onChange={(e) => {
              const next = Number(e.target.value);
              setOrderInput(Number.isFinite(next) ? next : null);
            }}
            className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      {error ? (
        <ErrorPlaceholder title="Could not create question">{error}</ErrorPlaceholder>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Saving…" : "Add question"}
      </button>
    </form>
  );
}

/**
 * Inline edit form rendered in place of a question card while that row is in
 * edit mode. Prefilled from `initial`; calls `onSubmit` with the validated
 * patch on save, or `onCancel` to discard local edits and return to the
 * read-only card. The parent owns the `editingId` state and exits edit mode
 * (sets `editingId = null`) only when `onSubmit` resolves successfully —
 * errors stay inline here so the user can fix and retry without losing their
 * draft.
 *
 * `eventId` is preserved automatically: `adminUpdateQuestion` doesn't accept
 * that field, so the server keeps the existing value untouched.
 */
function EditQuestionForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: QuestionDoc;
  onCancel: () => void;
  onSubmit: (values: QuestionEditValues) => Promise<void>;
}) {
  const [question, setQuestion] = useState(initial.question);
  const [options, setOptions] = useState<string[]>(initial.options.slice());
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(
    initial.correctAnswerIndex,
  );
  const [order, setOrder] = useState<number>(initial.order);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim());

    if (!trimmedQuestion) {
      setError("Question text is required.");
      return;
    }
    if (
      trimmedOptions.length !== 4 ||
      trimmedOptions.some((o) => o === "")
    ) {
      setError("All four options are required.");
      return;
    }
    if (
      !Number.isInteger(correctAnswerIndex) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      setError("Correct answer must be one of the four options.");
      return;
    }
    if (!Number.isFinite(order) || order < 1) {
      setError("Order must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        question: trimmedQuestion,
        options: trimmedOptions,
        correctAnswerIndex,
        order,
        isActive,
      });
      // Parent unmounts this form on success — no local reset needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const questionInputId = `edit-question-${initial._id}`;
  const radioGroupName = `edit-correct-${initial._id}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Editing question #{initial.order}
        </h3>
        <code className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {initial._id}
        </code>
      </div>

      <div>
        <label
          htmlFor={questionInputId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Question
        </label>
        <input
          id={questionInputId}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          disabled={submitting}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Options (mark the correct one)
        </legend>
        {options.map((opt, i) => (
          <label
            key={i}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <input
              type="radio"
              name={radioGroupName}
              checked={correctAnswerIndex === i}
              onChange={() => setCorrectAnswerIndex(i)}
              disabled={submitting}
              aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
            />
            <span className="font-mono text-xs text-zinc-500">
              {String.fromCharCode(65 + i)}.
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const next = options.slice();
                next[i] = e.target.value;
                setOptions(next);
              }}
              required
              disabled={submitting}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 focus:outline-none disabled:opacity-60 dark:text-zinc-50"
            />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          Order
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(order) ? order : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              setOrder(Number.isFinite(n) ? n : Number.NaN);
            }}
            disabled={submitting}
            className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={submitting}
          />
          Active
        </label>
      </div>

      {error ? (
        <ErrorPlaceholder title="Could not save question">
          {error}
        </ErrorPlaceholder>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
