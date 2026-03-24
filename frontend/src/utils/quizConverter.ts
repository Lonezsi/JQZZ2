import type { Quiz as FrontendQuiz } from "../types";

export function convertToBackendQuiz(frontendQuiz: FrontendQuiz): object {
  const actions = frontendQuiz.actions.map((action) => ({
    id: action.id,
    phase: action.phase,
    time: action.time,
    question: action.question, // full question object, will be saved via cascade
  }));

  return {
    id: frontendQuiz.id,
    name: frontendQuiz.name,
    authorId: frontendQuiz.authorId,
    actions,
  };
}
