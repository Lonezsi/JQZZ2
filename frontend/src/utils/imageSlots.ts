import type { Action, Question } from "../types";

/** A place on a step where a picture can go. */
export interface ImageSlot {
  key: string;
  label: string;
  src?: string | null;
}

/**
 * The pictures a step shows, the slots a dragged image can land in: the
 * question's own on the question step, each option's where options are on
 * screen, the explanation's on the explanation step.
 */
export function imageSlots(action: Action): ImageSlot[] {
  const q = action.question;
  if (!q) return [];
  const written = q.type?.startsWith("USER_GENERATED");
  const answers = written ? [] : (q.answers ?? []).map((a, i) => ({
    key: `answer:${a.id}`,
    label: a.text?.trim() || `option ${i + 1}`,
    src: a.imageUrl,
  }));
  switch (action.phase) {
    case "QUESTION":
      return [{ key: "question", label: "question", src: q.imageUrl }, ...answers];
    case "ANSWER":
      return answers;
    case "ELABORATION":
      return [{ key: "elaboration", label: "explanation", src: q.elaborationImageUrl }];
    default:
      return [];
  }
}

/** The change to the question that puts this picture in that slot. */
export function placeImage(q: Question, slot: string, ref: string): Partial<Question> {
  if (slot === "question") return { imageUrl: ref };
  if (slot === "elaboration") return { elaborationImageUrl: ref };
  const id = Number(slot.slice("answer:".length));
  return { answers: q.answers.map((a) => (a.id === id ? { ...a, imageUrl: ref } : a)) };
}
