import { useState, useEffect, useRef } from "react";
import type { Quiz, Action, Question, Answer, Phase } from "../types";
import { quizService } from "../services/quizService";

// Types matching backend response (as per Swagger)
interface BackendAction {
  id: number;
  phase: Phase;
  time: number;
  question?: {
    id: number;
    text: string;
    imageUrl?: string;
    elaborationText?: string;
    elaborationImageUrl?: string;
    type: string;
    userId?: string;
    answers?: Answer[]; // Not needed for preview, but we can ignore
  };
  orderIndex?: number; // not used
  preview?: string; // not present in backend; we generate it
}

interface BackendQuiz {
  id: number;
  name: string;
  authorId: string;
  actions: BackendAction[];
}

export const useQuizzes = () => {
  const hasFetched = useRef(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform backend Quiz to frontend Quiz
  function transformQuiz(backendQuiz: BackendQuiz): Quiz {
    const questionsMap = new Map<number, Question>();
    const actions: Action[] = backendQuiz.actions.map((action) => {
      const question = action.question;
      if (question) {
        // Store question in map if not already present
        if (!questionsMap.has(question.id)) {
          questionsMap.set(question.id, {
            id: question.id,
            text: question.text,
            imageUrl: question.imageUrl || "",
            elaborationText: question.elaborationText || "",
            type: question.type,
            answers: [], // answers not needed for display, but keep empty array
          });
        }
        // Create preview text for card display
        let preview = "";
        switch (action.phase) {
          case "WAITING":
            preview = `Wait ${action.time}s`;
            break;
          case "QUESTION":
            preview = question.text.slice(0, 40);
            break;
          case "ANSWER":
            preview = "Show answers";
            break;
          case "ELABORATION":
            preview = question.elaborationText?.slice(0, 40) || "Elaboration";
            break;
          case "RESULT":
            preview = "Show results";
            break;
          default:
            preview = action.phase;
        }
        return {
          id: action.id,
          phase: action.phase as Phase, // ensure casting to Phase
          time: action.time,
          questionId: question.id,
          preview,
        };
      } else {
        // For TEXT or DIVIDER actions (no question)
        return {
          id: action.id,
          phase: action.phase as Phase,
          time: action.time,
          questionId: 0,
          preview: action.phase === "TEXT" ? "Note" : "---",
        };
      }
    });

    return {
      id: backendQuiz.id,
      name: backendQuiz.name,
      authorId: backendQuiz.authorId,
      actions,
      questions: Array.from(questionsMap.values()),
    };
  }

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await quizService.getAll();
      // Assume response.data is array of BackendQuiz
      const transformed = response.data.map(transformQuiz);
      setQuizzes(transformed);
      setError(null);
    } catch (err) {
      setError("Failed to load quizzes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchQuizzes();
    }
  });

  return { quizzes, setQuizzes, loading, error, refetch: fetchQuizzes };
};
