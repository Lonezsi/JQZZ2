import { useState, useEffect, useCallback, useRef } from "react";
import type { Quiz, Action } from "../types";
import { quizService } from "../services/quizService";

/** Derive the preview text for an action from its question/phase data */
function derivePreview(action: Action): string {
  if (action.preview) return action.preview; // already set
  if (action.phase === "DIVIDER") return "---";
  if (action.phase === "TEXT") return action.preview || "";
  const q = action.question;
  if (!q) return action.phase;
  const label = action.phase.charAt(0) + action.phase.slice(1).toLowerCase();
  const snippet = q.text?.length > 40 ? q.text.slice(0, 40) + "\u2026" : q.text || "\u2026";
  return `${label}: \"${snippet}\"`;
}

/** Ensure all actions in a quiz have a derived preview */
function enrichQuizPreview(quiz: Quiz): Quiz {
  return {
    ...quiz,
    actions: quiz.actions.map((a) => ({
      ...a,
      preview: derivePreview(a),
    })),
  };
}

export const useQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await quizService.getAll();
      setQuizzes(response.data.map(enrichQuizPreview));
      setError(null);
    } catch (err) {
      console.error("Failed to fetch quizzes", err);
      setError("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchQuizzes();
    }
  }, [fetchQuizzes]);

  return { quizzes, setQuizzes, loading, error, refetch: fetchQuizzes };
};
