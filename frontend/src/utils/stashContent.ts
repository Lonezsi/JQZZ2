import type { Action, Question } from "../types";
import type { StashContent, StashItem, TypeShape } from "../types/stash";
import { SNIPPETS } from "../constants/snippets";
import { generateId } from "./idGenerator";

export function readContent(item: Pick<StashItem, "payload">): StashContent {
  try {
    const c = JSON.parse(item.payload ?? "{}");
    return { name: c.name, questions: c.questions ?? [], steps: c.steps ?? [] };
  } catch {
    return { questions: [], steps: [] };
  }
}

/**
 * Stashed steps as fresh editor actions. Steps that asked the same question
 * share one question object, the way the editor keeps them.
 */
export function contentToActions(content: StashContent): Action[] {
  const byKey = new Map<number, Question>();
  for (const q of content.questions) {
    byKey.set(q.key, {
      id: generateId(),
      text: q.text ?? "",
      type: q.type,
      imageUrl: q.imageUrl ?? undefined,
      elaborationText: q.elaborationText ?? undefined,
      elaborationImageUrl: q.elaborationImageUrl ?? undefined,
      answers: q.answers.map((a) => ({
        id: generateId(),
        text: a.text ?? "",
        value: a.value ?? 0,
        imageUrl: a.imageUrl ?? undefined,
      })),
    });
  }
  return content.steps.map((s) => ({
    id: generateId(),
    phase: s.phase,
    time: s.time,
    preview: s.preview ?? "",
    question: s.question == null ? null : (byKey.get(s.question) ?? null),
  }));
}

export function readType(item: Pick<StashItem, "payload" | "title">): TypeShape {
  try {
    const t = JSON.parse(item.payload ?? "{}");
    return {
      name: t.name ?? item.title ?? "question type",
      questionType: t.questionType ?? "PREWRITTEN_SINGLE",
      answers: t.answers ?? [],
      steps: t.steps ?? [],
    };
  } catch {
    return { name: item.title ?? "question type", questionType: "PREWRITTEN_SINGLE", answers: [], steps: [] };
  }
}

/** A new, empty question of this shape, with all its steps. */
export function typeToActions(t: TypeShape): Action[] {
  const question: Question = {
    id: generateId(),
    text: "New Question",
    imageUrl: "",
    type: t.questionType,
    elaborationText: "",
    answers: t.answers.map((a) => ({ id: generateId(), text: a.text ?? "", value: a.value ?? 0 })),
  };
  return t.steps.map((s) => ({
    id: generateId(),
    phase: s.phase,
    time: s.time,
    question,
    preview: s.preview ?? "",
  }));
}

/** The built-in snippets as shapes: what the tray shows before your stash has loaded. */
export const FALLBACK_TYPES: TypeShape[] = SNIPPETS.map((s) => ({
  name: s.name,
  questionType: s.id === "s-tier" ? "TIERLIST" : s.id === "s-ugv" ? "USER_GENERATED_VOTE" : "PREWRITTEN_SINGLE",
  answers: [],
  steps: s.steps,
}));
