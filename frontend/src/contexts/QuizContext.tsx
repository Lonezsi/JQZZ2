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
import { API_BASE_URL, errorMessage, keyHeader } from "../services/api";
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
  /** the open quiz is still on its way: only its summary is here so far */
  quizLoading: boolean;
  /** that summary, while it's all there is: enough to draw the right placeholders */
  quizSummary: Quiz | undefined;
  /** start fetching a quiz in full before it's opened (pointing at it in the list) */
  prefetchQuiz: (id: number) => void;
  renderItems: RenderItem[];
  // Mutations
  updateAction: (id: number, patch: Partial<Action>) => void;
  updateQuestion: (id: number, patch: Partial<Question>) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  reorderActions: (dragId: number, dropId: number) => void;
  /** a whole question's steps moved together, in front of another step (null: to the end) */
  moveActions: (ids: number[], beforeId: number | null) => void;
  /** a whole question's steps, gone */
  deleteActions: (ids: number[]) => void;
  newQuiz: () => Promise<number | undefined>;
  renameQuiz: (id: number, name: string) => void;
  /** gone for good, from the server and the list */
  deleteQuiz: (id: number) => Promise<void>;
  /** a quiz the server just made, e.g. one opened from the stash */
  addQuiz: (quiz: Quiz) => void;
  /** steps from the stash, added to the end of a quiz */
  appendActions: (quizId: number, actions: Action[]) => void;
  /** a new quiz from a script, opened; resolves to it, or null when it couldn't be made */
  importScript: (name: string, script: string) => Promise<Quiz | null>;
  dropSnippet: (snippetId: string, at?: number) => void;
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

  // the list holds summaries; the open quiz is swapped for the whole thing
  const listed = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId),
    [quizzes, activeQuizId],
  );
  const quiz = listed?.summary ? undefined : listed;
  const quizLoading = !!listed?.summary;
  const quizSummary = listed?.summary ? listed : undefined;

  const renderItems = useMemo(() => buildRenderItems(quiz), [quiz]);

  const authorId = user?.id || "";

  const {
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    moveActions,
    deleteActions,
    newQuiz: createQuiz,
    dropSnippet,
    handleParsed,
  } = useQuizMutations(activeQuizId, setQuizzes, authorId);

  // named after whoever makes it: "Velour Moth's quiz", then "... quiz 2"
  const newQuiz = useCallback(async () => {
    const who = (user?.name ?? "").replace(/\s*\(guest\)\s*$/i, "").trim();
    const base = who ? `${who}'s quiz` : "new quiz";
    const taken = new Set(quizzes.filter((q) => q.authorId === authorId).map((q) => q.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
    const id = await createQuiz(name);
    if (id) setActiveQuizId(id);
    return id;
  }, [createQuiz, user?.name, quizzes, authorId]);

  const importScript = useCallback(
    async (name: string, script: string) => {
      const { actions, errors } = parseScript(script, []);
      if (errors.length > 0) {
        alert(`couldn't import ${name}:\n\n${errors.slice(0, 10).join("\n")}`);
        return null;
      }
      try {
        const res = await quizService.create(
          convertToBackendQuiz({ id: 0, name, authorId, actions }),
        );
        setQuizzes((prev) => [...prev, res.data]);
        setActiveQuizId(res.data.id);
        return res.data;
      } catch (err) {
        alert(`import failed: ${errorMessage(err)}`);
        return null;
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

  const deleteQuiz = useCallback(
    async (id: number) => {
      try {
        await quizService.delete(id, authorId);
      } catch (err) {
        alert(`couldn't delete it: ${errorMessage(err)}`);
        return;
      }
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      setActiveQuizId((current) => (current === id ? null : current));
    },
    [setQuizzes, authorId],
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

  // A quiz in full, in place of its summary: when it's opened, or earlier,
  // when the pointer rests on it in the list, so it's usually here by the
  // time it's clicked and opens without placeholders.
  const fetching = useRef(new Set<number>());
  const loadFull = useCallback(
    (id: number) => {
      const summary = quizzesRef.current.find((q) => q.id === id);
      if (!summary?.summary || fetching.current.has(id)) return;
      fetching.current.add(id);
      quizService
        .getOne(id)
        .then((res) => {
          const full = {
            ...res.data,
            actions: res.data.actions.map((a) => ({
              ...a,
              preview: a.preview || summary.actions.find((s) => s.id === a.id)?.preview || "",
            })),
          };
          // it's what the server has: loading it isn't an edit, so nothing to save
          persisted.current.set(id, full);
          setQuizzes((prev) => prev.map((q) => (q.id === id && q.summary ? full : q)));
        })
        .catch(() => {})
        .finally(() => fetching.current.delete(id));
    },
    [setQuizzes],
  );
  useEffect(() => {
    if (listed?.summary) loadFull(listed.id);
  }, [listed, loadFull]);

  // Last-chance save when the tab closes or reloads mid-debounce.
  useEffect(() => {
    const onUnload = () => {
      for (const q of quizzesRef.current) {
        if (!isDirty(persisted.current, q)) continue;
        fetch(`${API_BASE_URL}/quizzes/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...keyHeader() },
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
    quizLoading,
    quizSummary,
    prefetchQuiz: loadFull,
    renderItems,
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    moveActions,
    deleteActions,
    newQuiz,
    renameQuiz,
    addQuiz,
    deleteQuiz,
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
