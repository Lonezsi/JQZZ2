import type { Action, Question } from "../types";
import type { StashContent, StashItem } from "../types/stash";
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
