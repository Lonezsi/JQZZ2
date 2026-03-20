import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
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
  selectedActionIds: Set<number>;
  toggleSelectAction: (
    id: number,
    ctrlKey?: boolean,
    shiftKey?: boolean,
  ) => void;
  selectAllActions: () => void;
  clearSelectedActions: () => void;
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
  shiftPressed: React.RefObject<boolean>;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { quizzes, setQuizzes } = useQuizzes();
  const { user } = useAuth();
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const [selectedActionIds, setSelectedActionIds] = useState<Set<number>>(
    new Set(),
  );
  const [lastSelectedActionId, setLastSelectedActionId] = useState<
    number | null
  >(null);
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

  const getActionIdsInOrder = useCallback((): number[] => {
    if (!quiz) return [];
    return quiz.actions.map((a) => a.id);
  }, [quiz]);

  const toggleSelectAction = useCallback(
    (id: number, ctrlKey: boolean = false, shiftKey: boolean = false) => {
      console.log("toggleSelectAction called", {
        id,
        ctrlKey,
        shiftKey,
        lastSelected: lastSelectedActionId,
      });
      setSelectedActionIds((prev) => {
        const newSet = new Set(prev);
        const actionIds = getActionIdsInOrder();

        if (shiftKey) {
          if (lastSelectedActionId !== null) {
            const lastIdx = actionIds.indexOf(lastSelectedActionId);
            const currentIdx = actionIds.indexOf(id);
            if (lastIdx !== -1 && currentIdx !== -1) {
              const start = Math.min(lastIdx, currentIdx);
              const end = Math.max(lastIdx, currentIdx);
              for (let i = start; i <= end; i++) {
                newSet.add(actionIds[i]);
              }
            }
          } else {
            // No anchor: select only this action
            newSet.clear();
            newSet.add(id);
          }
          setLastSelectedActionId(id);
          console.log("new selection set", Array.from(newSet));
          return newSet;
        }

        if (ctrlKey) {
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          setLastSelectedActionId(id);
          return newSet;
        }

        // No modifier
        if (newSet.size === 1 && newSet.has(id)) {
          newSet.clear();
          setLastSelectedActionId(null);
        } else {
          newSet.clear();
          newSet.add(id);
          setLastSelectedActionId(id);
        }
        return newSet;
      });
    },
    [getActionIdsInOrder, lastSelectedActionId],
  );

  const selectAllActions = useCallback(() => {
    const actionIds = getActionIdsInOrder();
    setSelectedActionIds(new Set(actionIds));
    if (actionIds.length > 0) {
      setLastSelectedActionId(actionIds[actionIds.length - 1]);
    }
  }, [getActionIdsInOrder]);

  const clearSelectedActions = useCallback(() => {
    setSelectedActionIds(new Set());
    setLastSelectedActionId(null);
  }, []);

  const shiftPressed = useRef(false);

  // Reset selection when quiz changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clearSelectedActions();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftPressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftPressed.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeQuizId, clearSelectedActions]);

  const value: QuizContextType = {
    shiftPressed,
    quizzes,
    setQuizzes,
    activeQuizId,
    setActiveQuizId,
    selectedActionIds,
    toggleSelectAction,
    selectAllActions,
    clearSelectedActions,
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

//eslint-disable-next-line react-refresh/only-export-components
export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (!context) throw new Error("useQuiz must be used within a QuizProvider");
  return context;
};
