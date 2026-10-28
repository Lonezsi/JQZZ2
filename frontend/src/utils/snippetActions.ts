import type { Action, Question } from "../types";
import { SNIPPETS } from "../constants/snippets";
import { generateId } from "./idGenerator";
import { contentToActions, readContent, readType, typeToActions } from "./stashContent";

/**
 * What a dragged or picked snippet becomes: fresh steps, ready to go into a
 * quiz. "set:..." is a settings block, "type:{json}" a new question of a
 * stashed type, "stash:{json}" a stashed question or whole quiz with its
 * settings, anything else a built-in shape.
 */
export function snippetActions(snippetId: string): Action[] {
  if (snippetId.startsWith("set:")) {
    return [{ id: generateId(), phase: "SETTING", time: 0, question: null, preview: snippetId.slice(4) }];
  }
  try {
    if (snippetId.startsWith("type:")) return typeToActions(readType({ payload: snippetId.slice(5), title: null }));
    if (snippetId.startsWith("stash:")) return contentToActions(readContent({ payload: snippetId.slice(6) }));
  } catch {
    return [];
  }
  const snippet = SNIPPETS.find((s) => s.id === snippetId);
  if (!snippet) return [];
  const question: Question = {
    id: generateId(),
    text: "New Question",
    imageUrl: "",
    type: "PREWRITTEN_SINGLE",
    elaborationText: "",
    answers: [],
  };
  return snippet.steps.map((s) => ({
    id: generateId(),
    phase: s.phase,
    time: s.time,
    question,
    preview: s.preview,
  }));
}
