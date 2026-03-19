import type { Quiz, RenderItem } from "../types";

export function buildRenderItems(quiz: Quiz | undefined): RenderItem[] {
  if (!quiz) return [];
  const items: RenderItem[] = [];
  let currentGroup: (RenderItem & { kind: "group" }) | null = null;
  for (const action of quiz.actions) {
    if (action.phase === "DIVIDER") {
      currentGroup = null;
      items.push({ kind: "divider", action });
    } else if (action.phase === "TEXT") {
      currentGroup = null;
      items.push({ kind: "text", action });
    } else {
      if (currentGroup && currentGroup.questionId === action.questionId) {
        currentGroup.actions.push(action);
      } else {
        currentGroup = {
          kind: "group",
          questionId: action.questionId,
          actions: [action],
        };
        items.push(currentGroup);
      }
    }
  }
  return items;
}
