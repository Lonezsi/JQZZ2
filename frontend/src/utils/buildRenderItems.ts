import type { Quiz, RenderItem, Question, Action } from "../types";

export function buildRenderItems(quiz: Quiz | undefined): RenderItem[] {
  if (!quiz) return [];
  const items: RenderItem[] = [];
  let currentGroup: {
    kind: "group";
    question: Question;
    actions: Action[];
  } | null = null;

  for (const action of quiz.actions) {
    if (action.phase === "DIVIDER") {
      currentGroup = null;
      items.push({ kind: "divider", action });
    } else if (action.phase === "TEXT") {
      currentGroup = null;
      items.push({ kind: "text", action });
    } else {
      // action has a question
      if (action.question) {
        if (currentGroup && currentGroup.question.id === action.question.id) {
          currentGroup.actions.push(action);
        } else {
          currentGroup = {
            kind: "group",
            question: action.question,
            actions: [action],
          };
          items.push(currentGroup);
        }
      } else {
        // fallback – should not happen for non-TEXT/DIVIDER actions
        items.push({ kind: "text", action });
      }
    }
  }
  return items;
}
