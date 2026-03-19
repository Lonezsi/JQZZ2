import React, { useState, useMemo, useCallback } from "react";
import { useQuizzes } from "../../hooks/useQuizzes";
import { useQuizMutations } from "../../hooks/useQuizMutations";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAuth } from "../../contexts/AuthContext";
import { Sidebar } from "./Sidebar/Sidebar";
import { Main } from "./Main/Main";
import { RightPanel } from "./RightPanel/RightPanel";
import { CommandPalette } from "../Modals/CommandPalette";
import { IdentityModal } from "../Modals/IdentityModal";
import { SNIPPETS } from "../../constants/snippets";
import { buildRenderItems } from "../../utils/buildRenderItems"; // we'll write this helper
import type { EditorMode } from "../../types";
import "../../index.css";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { quizzes, setQuizzes, loading, error, refetch } = useQuizzes();
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const quiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId),
    [quizzes, activeQuizId],
  );

  const questionMap = useMemo(
    () => new Map(quiz?.questions.map((q) => [q.id, q])),
    [quiz],
  );

  const {
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    dropSnippet: dropSnippetMutation,
    handleParsed,
  } = useQuizMutations(activeQuizId, setQuizzes, user?.id || "");

  const dropSnippet = useCallback(
    (snippetId: string) => {
      if (!activeQuizId) return;
      dropSnippetMutation(snippetId);
    },
    [activeQuizId, dropSnippetMutation],
  );

  const {
    draggingSnippet,
    dropOver,
    dragActionId,
    dragOverActionId,
    onSnippetDragStart,
    onSnippetDragEnd,
    onDropZoneDragOver,
    onDropZoneDragLeave,
    onDropZoneDrop,
    onActionDragStart,
    onActionDragEnd,
    onActionDragOver,
    onActionDrop,
  } = useDragAndDrop(dropSnippet, reorderActions);

  const handleExport = useCallback(() => {
    if (!quiz) return;
    // reuse quizToScript from utils
    import("../../utils/scriptSerializer").then(({ quizToScript }) => {
      const blob = new Blob([quizToScript(quiz)], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${quiz.name.replace(/\s+/g, "_")}.txt`;
      a.click();
    });
  }, [quiz]);

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(true),
    onNewQuiz: newQuiz,
    onToggleMode: () => setMode((m) => (m === "visual" ? "text" : "visual")),
    onEscape: () => {
      setPaletteOpen(false);
      setIdentityOpen(false);
    },
    onExport: handleExport,
  });

  const renderItems = useMemo(() => buildRenderItems(quiz), [quiz]);

  if (loading) return <div className="jqzz-dash">Loading quizzes...</div>;
  if (error) return <div className="jqzz-dash">Error: {error}</div>;

  return (
    <div className="jqzz-dash">
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {identityOpen && user && (
        <IdentityModal
          current={user}
          onSave={(updated) => {
            // update via context
            // also call API
            setIdentityOpen(false);
          }}
          onClose={() => setIdentityOpen(false)}
        />
      )}

      <Sidebar
        identity={user}
        onIdentityClick={() => setIdentityOpen(true)}
        quizzes={quizzes}
        activeQuizId={activeQuizId}
        onSelectQuiz={(id) => {
          setActiveQuizId(id);
          setSelectedActionId(null);
        }}
        onNewQuiz={newQuiz}
        snippets={SNIPPETS}
        draggingSnippet={draggingSnippet}
        onSnippetDragStart={onSnippetDragStart}
        onSnippetDragEnd={onSnippetDragEnd}
        onSnippetClick={dropSnippet}
      />

      <Main
        mode={mode}
        setMode={setMode}
        onOpenPalette={() => setPaletteOpen(true)}
        onExport={handleExport}
        quiz={quiz}
        renderItems={renderItems}
        questionMap={questionMap}
        selectedActionId={selectedActionId}
        setSelectedActionId={setSelectedActionId}
        dragActionId={dragActionId}
        dragOverActionId={dragOverActionId}
        onActionDragStart={onActionDragStart}
        onActionDragEnd={onActionDragEnd}
        onActionDragOver={onActionDragOver}
        onActionDrop={onActionDrop}
        deleteAction={deleteAction}
        duplicateAction={duplicateAction}
        dropOver={dropOver}
        onDropZoneDragOver={onDropZoneDragOver}
        onDropZoneDragLeave={onDropZoneDragLeave}
        onDropZoneDrop={onDropZoneDrop}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        onParsed={handleParsed}
      />

      <RightPanel
        quiz={quiz}
        questionMap={questionMap}
        selectedAction={
          quiz?.actions.find((a) => a.id === selectedActionId) ?? null
        }
        onActionUpdate={updateAction}
        onQuestionUpdate={updateQuestion}
      />
    </div>
  );
};
