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
import { quizService } from "../services/quizService";
import { API_BASE_URL, errorMessage } from "../services/api";
import { convertToBackendQuiz } from "../utils/quizConverter";
import { parseScript } from "../utils/scriptParser";

export type SaveState = "saved" | "saving" | "error";

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
  saveState: SaveState;
  lastSavedAt: Date | null;
  // Derived
  quiz: Quiz | undefined;
  renderItems: RenderItem[];
  // Mutations
  updateAction: (id: number, patch: Partial<Action>) => void;
  updateQuestion: (id: number, patch: Partial<Question>) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  reorderActions: (dragId: number, dropId: number) => void;
  newQuiz: () => Promise<number | undefined>;
  renameQuiz: (id: number, name: string) => void;
  /** a quiz the server just made, e.g. one opened from the stash */
  addQuiz: (quiz: Quiz) => void;
  /** steps from the stash, added to the end of a quiz */
  appendActions: (quizId: number, actions: Action[]) => void;
  importScript: (name: string, script: string) => Promise<void>;
  dropSnippet: (snippetId: string) => void;
  handleParsed: (questions: Question[], actions: Action[]) => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 3000;

const isDirty = (persisted: Map<number, Quiz>, q: Quiz) =>
  persisted.get(q.id) !== q;

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

  const renderItems = useMemo(() => buildRenderItems(quiz), [quiz]);

  const authorId = user?.id || "";

  const {
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz: createQuiz,
    dropSnippet,
    handleParsed,
  } = useQuizMutations(activeQuizId, setQuizzes, authorId);

  const newQuiz = useCallback(async () => {
    const id = await createQuiz();
    if (id) setActiveQuizId(id);
    return id;
  }, [createQuiz]);

  const importScript = useCallback(
    async (name: string, script: string) => {
      const { actions, errors } = parseScript(script, []);
      if (errors.length > 0) {
        alert(`couldn't import ${name}:\n\n${errors.slice(0, 10).join("\n")}`);
        return;
      }
      try {
        const res = await quizService.create(
          convertToBackendQuiz({ id: 0, name, authorId, actions }),
        );
        setQuizzes((prev) => [...prev, res.data]);
        setActiveQuizId(res.data.id);
      } catch (err) {
        alert(`import failed: ${errorMessage(err)}`);
      }
    },
    [authorId, setQuizzes],
  );

  const renameQuiz = useCallback(
    (id: number, name: string) =>
      setQuizzes((prev) => prev.map((q) => (q.id === id ? { ...q, name } : q))),
    [setQuizzes],
  );

  const addQuiz = useCallback(
    (quiz: Quiz) => setQuizzes((prev) => [...prev.filter((q) => q.id !== quiz.id), quiz]),
    [setQuizzes],
  );

  const appendActions = useCallback(
    (quizId: number, actions: Action[]) =>
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quizId ? { ...q, actions: [...q.actions, ...actions] } : q)),
      ),
    [setQuizzes],
  );

  // --- Persistence logic ---
  // A quiz is dirty when its object differs from the one last loaded from or
  // saved to the server; every edit produces a new object. Saves are queued
  // per quiz, so edits made while a save is in flight are saved right after.
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const quizzesRef = useRef(quizzes);
  const persisted = useRef(new Map<number, Quiz>());
  const inFlight = useRef(new Set<number>());
  const saveTimer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    saveTimer.current = undefined;
    const pending = quizzesRef.current.filter(
      (q) => isDirty(persisted.current, q) && !inFlight.current.has(q.id),
    );
    if (pending.length === 0) return;

    setSaveState("saving");
    let failed = false;
    await Promise.all(
      pending.map(async (q) => {
        inFlight.current.add(q.id);
        try {
          await quizService.update(q.id, convertToBackendQuiz(q));
          persisted.current.set(q.id, q);
        } catch (err) {
          failed = true;
          console.error("Failed to save quiz", q.id, errorMessage(err));
        } finally {
          inFlight.current.delete(q.id);
        }
      }),
    );

    if (failed) {
      setSaveState("error");
      saveTimer.current = window.setTimeout(flush, RETRY_DELAY_MS);
    } else if (quizzesRef.current.some((q) => isDirty(persisted.current, q))) {
      saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    } else {
      setSaveState("saved");
      setLastSavedAt(new Date());
    }
  }, []);

  useEffect(() => {
    quizzesRef.current = quizzes;
    let dirty = false;
    for (const q of quizzes) {
      // first sighting = fresh from the server
      if (!persisted.current.has(q.id)) persisted.current.set(q.id, q);
      else if (isDirty(persisted.current, q)) dirty = true;
    }
    if (!dirty) return;
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [quizzes, flush]);

  // Last-chance save when the tab closes or reloads mid-debounce.
  useEffect(() => {
    const onUnload = () => {
      for (const q of quizzesRef.current) {
        if (!isDirty(persisted.current, q)) continue;
        fetch(`${API_BASE_URL}/quizzes/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(convertToBackendQuiz(q)),
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      window.clearTimeout(saveTimer.current);
    };
  }, []);

  // --- Selection logic ---
  const getActionIdsInOrder = useCallback((): number[] => {
    if (!quiz) return [];
    return quiz.actions.map((a) => a.id);
  }, [quiz]);

  const toggleSelectAction = useCallback(
    (id: number, ctrlKey: boolean = false, shiftKey: boolean = false) => {
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
            newSet.clear();
            newSet.add(id);
          }
          setLastSelectedActionId(id);
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

  // Reset selection when quiz changes
  useEffect(() => {
    clearSelectedActions();
  }, [activeQuizId, clearSelectedActions]);

  const value: QuizContextType = {
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
    saveState,
    lastSavedAt,
    quiz,
    renderItems,
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    renameQuiz,
    addQuiz,
    appendActions,
    importScript,
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
