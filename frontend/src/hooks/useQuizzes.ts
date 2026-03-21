import { useState, useEffect, useRef } from "react";
import type { Quiz, Action, Question } from "../types";
import { quizService } from "../services/quizService";

// Fallback quizzes for demo (if backend fails)
const FALLBACK_QUIZZES: Quiz[] = [
  {
    id: 1,
    name: "Demo Quiz",
    authorId: "guest",
    actions: [],
    questions: [],
  },
];

export const useQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const transformQuiz = (backendQuiz: Quiz): Quiz => {
    const questionsMap = new Map<number, Question>();
    const actions: Action[] = (backendQuiz.actions || []).map(
      (action: Action) => {
        const question =
          backendQuiz.questions.find((q) => q.id === action.questionId) || null;
        let questionId = 0;
        if (question) {
          questionId = question.id;
          if (!questionsMap.has(question.id)) {
            questionsMap.set(question.id, question);
          }
        } else {
          questionId = action.questionId || 0;
        }

        let preview = action.preview || "";
        if (!preview && question) {
          switch (action.phase) {
            case "QUESTION":
              preview = `Question: ${question.text?.slice(0, 30) || "?"}`;
              break;
            case "WAITING":
              preview = "Waiting...";
              break;
            case "ANSWER":
              preview = "Answer phase";
              break;
            case "ELABORATION":
              preview = `Elaboration: ${question.elaborationText?.slice(0, 30) || "..."}`;
              break;
            case "RESULT":
              preview = "Show results";
              break;
            default:
              preview = action.phase;
          }
        }

        return {
          id: action.id,
          phase: action.phase,
          time: action.time,
          questionId: questionId,
          preview: preview,
        };
      },
    );

    return {
      id: backendQuiz.id,
      name: backendQuiz.name,
      authorId: backendQuiz.authorId,
      actions,
      questions: Array.from(questionsMap.values()),
    };
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await quizService.getAll();
      const transformed = response.data.map(transformQuiz);
      setQuizzes(transformed);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch quizzes, using fallback data", err);
      setError("Failed to load quizzes from server, using demo data");
      setQuizzes(FALLBACK_QUIZZES);
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
