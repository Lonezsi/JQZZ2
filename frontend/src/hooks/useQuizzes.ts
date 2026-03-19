import { useState, useEffect } from "react";
import type { Quiz } from "../types";
import { quizService } from "../services/quizService";

export const useQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await quizService.getAll();
      setQuizzes(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load quizzes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  return { quizzes, setQuizzes, loading, error, refetch: fetchQuizzes };
};
