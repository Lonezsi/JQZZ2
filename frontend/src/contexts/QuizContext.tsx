import React, { createContext, useContext, useMemo, useState } from "react";
import { useQuizzes } from "../hooks/useQuizzes";
import { useQuizMutations } from "../hooks/useQuizMutations";
import { useAuth } from "./AuthContext";
import type { Quiz, Question, Action, EditorMode, RenderItem } from "../types";
import { buildRenderItems } from "../utils/buildRenderItems";

interface QuizContextType {
  quizzes: Quiz[];
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  activeQuizId: number | null;
  setActiveQuizId: (id: number | null) => void;
  selectedActionId: number | null;
  setSelectedActionId: (id: number | null) => void;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  // Derived
  quiz: Quiz | undefined;
  questionMap: Map<number, Question>;
  renderItems: RenderItem[];
  // Mutations
  updateAction: (id: number, patch: Partial<Action>) => void;
  updateQuestion: (id: number, patch: Partial<Question>) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  reorderActions: (dragId: number, dropId: number) => void;
  newQuiz: () => Promise<number | undefined>;
  dropSnippet: (snippetId: string) => void;
  handleParsed: (questions: Question[], actions: Action[]) => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { quizzes, setQuizzes } = useQuizzes();
  const { user } = useAuth();
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [aiPrompt, setAiPrompt] = useState("");

  const quiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId),
    [quizzes, activeQuizId],
  );
  const questionMap = useMemo(
    () => new Map(quiz?.questions.map((q) => [q.id, q])),
    [quiz],
  );
  const renderItems = useMemo(() => buildRenderItems(quiz), [quiz]);

  const authorId = user?.id || "";

  const {
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    dropSnippet,
    handleParsed,
  } = useQuizMutations(activeQuizId, setQuizzes, authorId);

  const value: QuizContextType = {
    quizzes,
    setQuizzes,
    activeQuizId,
    setActiveQuizId,
    selectedActionId,
    setSelectedActionId,
    mode,
    setMode,
    aiPrompt,
    setAiPrompt,
    quiz,
    questionMap,
    renderItems,
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    dropSnippet,
    handleParsed,
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (!context) throw new Error("useQuiz must be used within a QuizProvider");
  return context;
};
