import { useCallback } from "react";
import type { Quiz, Action, Question } from "../types";
import { quizService } from "../services/quizService";
import { generateId } from "../utils/idGenerator";
import { errorMessage } from "../services/api";
import { snippetActions } from "../utils/snippetActions";
import { DEFAULTS, formatSettings, settingsAt } from "../utils/settings";
import type { QuizSettings } from "../utils/settings";

const same = (a: QuizSettings, b: QuizSettings) =>
  (Object.keys(DEFAULTS) as (keyof QuizSettings)[]).every((k) => a[k] === b[k]);
const block = (s: QuizSettings): Action => ({
  id: generateId(),
  phase: "SETTING",
  time: 0,
  question: null,
  preview: formatSettings(s),
});

/**
 * Steps carrying their own settings blocks (a whole quiz) keep to themselves
 * when pasted in among other questions: they start from the defaults they
 * were made with, and whatever was in force there comes back after them.
 */
function selfContained(added: Action[], actions: Action[], at: number): Action[] {
  if (!added.some((a) => a.phase === "SETTING") || !added.some((a) => a.question)) return added;
  const before = at > 0 ? (settingsAt(actions).get(actions[at - 1].id) ?? DEFAULTS) : DEFAULTS;
  const after = settingsAt(added).get(added[added.length - 1].id) ?? DEFAULTS;
  const out = [...added];
  if (!same(before, DEFAULTS)) out.unshift(block(DEFAULTS));
  const leaving = same(before, DEFAULTS) ? after : (settingsAt(out).get(out[out.length - 1].id) ?? DEFAULTS);
  if (at < actions.length && !same(leaving, before)) out.push(block(before));
  return out;
}

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

  /** A snippet's steps into the open quiz: at an action index, or at the end. */
  const dropSnippet = useCallback(
    (snippetId: string, at?: number) => {
      if (!activeQuizId) return;
      const added = snippetActions(snippetId);
      if (added.length === 0) return;
      setQuizzes((prev) =>
        prev.map((quiz) => {
          if (quiz.id !== activeQuizId) return quiz;
          const i = at == null ? quiz.actions.length : Math.max(0, Math.min(at, quiz.actions.length));
          return { ...quiz, actions: [...quiz.actions.slice(0, i), ...selfContained(added, quiz.actions, i), ...quiz.actions.slice(i)] };
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
