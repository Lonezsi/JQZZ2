import type { Quiz as FrontendQuiz, Question } from "../types";

export function convertToBackendQuiz(frontendQuiz: FrontendQuiz): object {
  const questionMap = new Map<number, Question>();
  frontendQuiz.questions.forEach((q) => questionMap.set(q.id, q));

  const actions = frontendQuiz.actions.map((action) => ({
    id: action.id,
    phase: action.phase,
    time: action.time,
    question: questionMap.get(action.questionId) || null,
  }));

  return {
    id: frontendQuiz.id,
    name: frontendQuiz.name,
    authorId: frontendQuiz.authorId,
    actions: actions.filter((a) => a.question !== null), // exclude actions without a question
  };
}
