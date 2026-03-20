import { useCallback } from "react";
import type { Quiz, Action, Question } from "../types";
import { quizService } from "../services/quizService";
import { SNIPPETS } from "../constants/snippets";

export const useQuizMutations = (
  activeQuizId: number | null,
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>,
  authorId: string,
) => {
  const updateQuiz = useCallback(
    (updater: (quiz: Quiz) => Quiz) => {
      setQuizzes((prev) =>
        prev.map((q) => (q.id === activeQuizId ? updater(q) : q)),
      );
    },
    [activeQuizId, setQuizzes],
  );

  const updateAction = useCallback(
    (id: number, patch: Partial<Action>) => {
      updateQuiz((quiz) => ({
        ...quiz,
        actions: quiz.actions.map((a) =>
          a.id === id ? { ...a, ...patch } : a,
        ),
      }));
      // TODO: debounced API call to save
    },
    [updateQuiz],
  );

  const updateQuestion = useCallback(
    (id: number, patch: Partial<Question>) => {
      updateQuiz((quiz) => ({
        ...quiz,
        questions: quiz.questions.map((q) =>
          q.id === id ? { ...q, ...patch } : q,
        ),
      }));
    },
    [updateQuiz],
  );

  const deleteAction = useCallback(
    (id: number) => {
      updateQuiz((quiz) => ({
        ...quiz,
        actions: quiz.actions.filter((a) => a.id !== id),
      }));
    },
    [updateQuiz],
  );

  const duplicateAction = useCallback(
    (id: number) => {
      updateQuiz((quiz) => {
        const idx = quiz.actions.findIndex((a) => a.id === id);
        if (idx === -1) return quiz;
        const clone: Action = { ...quiz.actions[idx], id: Date.now() };
        const newActions = [...quiz.actions];
        newActions.splice(idx + 1, 0, clone);
        return { ...quiz, actions: newActions };
      });
    },
    [updateQuiz],
  );

  const reorderActions = useCallback(
    (dragId: number, dropId: number) => {
      if (dragId === dropId) return;
      updateQuiz((quiz) => {
        const arr = [...quiz.actions];
        const from = arr.findIndex((a) => a.id === dragId);
        const to = arr.findIndex((a) => a.id === dropId);
        if (from === -1 || to === -1) return quiz;
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        return { ...quiz, actions: arr };
      });
    },
    [updateQuiz],
  );

  const newQuiz = useCallback(async () => {
    try {
      const response = await quizService.create({
        name: `Quiz ${Date.now()}`,
        authorId,
      });
      setQuizzes((prev) => [...prev, response.data]);
      return response.data.id;
    } catch (error) {
      console.error("Failed to create quiz", error);
    }
  }, [setQuizzes, authorId]);

  const dropSnippet = useCallback(
    (snippetId: string) => {
      const snippet = SNIPPETS.find((s) => s.id === snippetId);
      if (!snippet || !activeQuizId) return;

      setQuizzes((prev) =>
        prev.map((quiz) => {
          if (quiz.id !== activeQuizId) return quiz;

          let targetQId: number;
          let updatedQuestions = quiz.questions;

          if (quiz.questions.length === 0) {
            targetQId = Date.now();
            updatedQuestions = [
              {
                id: targetQId,
                text: "New Question",
                imageUrl: "",
                type: "PREWRITTEN_SINGLE",
                elaborationText: "",
                answers: [],
              },
            ];
          } else {
            targetQId = quiz.questions[quiz.questions.length - 1].id;
          }

          const base = Date.now();
          const newActions: Action[] = snippet.steps.map((s, i) => ({
            id: base + i,
            phase: s.phase,
            time: s.time,
            questionId: targetQId,
            preview: s.preview,
          }));

          return {
            ...quiz,
            questions: updatedQuestions,
            actions: [...quiz.actions, ...newActions],
          };
        }),
      );
    },
    [activeQuizId, setQuizzes],
  );

  const handleParsed = useCallback(
    (questions: Question[], actions: Action[]) => {
      updateQuiz((quiz) => ({
        ...quiz,
        questions,
        actions,
      }));
      // TODO: call API to save
    },
    [updateQuiz],
  );

  return {
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    dropSnippet,
    handleParsed,
  };
};
