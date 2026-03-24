import { useState, useEffect, useCallback, useRef } from "react";
import type { Quiz } from "../types";
import { quizService } from "../services/quizService";

export const useQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await quizService.getAll();
      setQuizzes(response.data);
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
