import { useCallback } from "react";
import type { Quiz, Action, Question } from "../types";
import { quizService } from "../services/quizService";
import { SNIPPETS } from "../constants/snippets";
import { generateId } from "../utils/idGenerator";
import { errorMessage } from "../services/api";
import { contentToActions, readContent } from "../utils/stashContent";

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
    },
    [updateQuiz],
  );

  const updateQuestion = useCallback(
    (id: number, patch: Partial<Question>) => {
      updateQuiz((quiz) => ({
        ...quiz,
        actions: quiz.actions.map((a) =>
          a.question?.id === id
            ? { ...a, question: { ...a.question, ...patch } }
            : a,
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
        // the copy shows the same question again, so it stays in its group
        const clone: Action = { ...quiz.actions[idx], id: generateId() };
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
        name: "untitled quiz",
        authorId,
        actions: [],
      });
      setQuizzes((prev) => [...prev, response.data]);
      return response.data.id;
    } catch (error) {
      console.error("Failed to create quiz", error);
      alert(`couldn't make a new quiz: ${errorMessage(error)}`);
    }
  }, [setQuizzes, authorId]);

  const dropSnippet = useCallback(
    (snippetId: string) => {
      if (!activeQuizId) return;
      // "set:shuffle=on": a settings block
      if (snippetId.startsWith("set:")) {
        const block: Action = {
          id: generateId(),
          phase: "SETTING",
          time: 0,
          question: null,
          preview: snippetId.slice(4),
        };
        setQuizzes((prev) =>
          prev.map((quiz) => (quiz.id === activeQuizId ? { ...quiz, actions: [...quiz.actions, block] } : quiz)),
        );
        return;
      }
      // "stash:{json}": a question or quiz from the stash, with all its steps
      if (snippetId.startsWith("stash:")) {
        let added: Action[] = [];
        try {
          added = contentToActions(readContent({ payload: snippetId.slice(6) }));
        } catch {
          return;
        }
        setQuizzes((prev) =>
          prev.map((quiz) => (quiz.id === activeQuizId ? { ...quiz, actions: [...quiz.actions, ...added] } : quiz)),
        );
        return;
      }
      const snippet = SNIPPETS.find((s) => s.id === snippetId);
      if (!snippet) return;

      setQuizzes((prev) =>
        prev.map((quiz) => {
          if (quiz.id !== activeQuizId) return quiz;

          const newQuestion: Question = {
            id: generateId(),
            text: "New Question",
            imageUrl: "",
            type: "PREWRITTEN_SINGLE",
            elaborationText: "",
            answers: [],
          };

          const newActions: Action[] = snippet.steps.map((s) => ({
            id: generateId(),
            phase: s.phase,
            time: s.time,
            question: newQuestion,
            preview: s.preview,
          }));

          return {
            ...quiz,
            actions: [...quiz.actions, ...newActions],
          };
        }),
      );
    },
    [activeQuizId, setQuizzes],
  );

  const handleParsed = useCallback(
    (questions: Question[], actions: Action[]) => {
      // Map each action's questionId to the full question object
      const questionMap = new Map<number, Question>();
      questions.forEach((q) => questionMap.set(q.id, q));

      const updatedActions = actions.map((a) => ({
        ...a,
        question: a.question?.id
          ? (questionMap.get(a.question.id) ?? null)
          : null,
      }));

      updateQuiz((quiz) => ({ ...quiz, actions: updatedActions }));
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
