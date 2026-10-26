import type { Quiz as FrontendQuiz, CreateQuizRequest } from "../types";

export function convertToBackendQuiz(
  frontendQuiz: FrontendQuiz,
): CreateQuizRequest & { id: number } {
  const actions = frontendQuiz.actions.map((action) => ({
    id: action.id,
    phase: action.phase,
    time: action.time,
    preview: action.preview, // card label; the content of TEXT notes
    question: action.question, // ids are only used to keep shared questions shared
  }));

  return {
    id: frontendQuiz.id,
    name: frontendQuiz.name,
    authorId: frontendQuiz.authorId,
    actions,
  };
}
