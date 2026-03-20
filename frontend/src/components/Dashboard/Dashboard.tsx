import React, { useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuiz } from "../../contexts/QuizContext";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { Sidebar } from "./Sidebar/Sidebar";
import { Main } from "./Main/Main";
import { RightPanel } from "./RightPanel/RightPanel";
import { CommandPalette } from "../Modals/CommandPalette";
import { IdentityModal } from "../Modals/IdentityModal";
import { SNIPPETS } from "../../constants/snippets";
import "../../index.css";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    quizzes,
    activeQuizId,
    setActiveQuizId,
    selectedActionIds, // <-- now a Set
    toggleSelectAction, // <-- for selection
    selectAllActions, // <-- for Ctrl+A
    clearSelectedActions,
    mode,
    setMode,
    aiPrompt,
    setAiPrompt,
    updateAction,
    updateQuestion,
    deleteAction,
    duplicateAction,
    reorderActions,
    newQuiz,
    dropSnippet: dropSnippetMutation,
    handleParsed,
    quiz,
  } = useQuiz();

  const dropSnippet = useCallback(
    (snippetId: string) => {
      dropSnippetMutation(snippetId);
    },
    [dropSnippetMutation],
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

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const handleExport = useCallback(() => {
    if (!quiz) return;
    import("../../utils/scriptSerializer").then(({ quizToScript }) => {
      const blob = new Blob([quizToScript(quiz)], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${quiz.name.replace(/\s+/g, "_")}.txt`;
      a.click();
    });
  }, [quiz]);

  // Determine which action to edit in the right panel
  const selectedActionIdsArray = Array.from(selectedActionIds);
  const firstSelectedId = selectedActionIdsArray[0] ?? null;
  const selectedAction = firstSelectedId
    ? (quiz?.actions.find((a) => a.id === firstSelectedId) ?? null)
    : null;
  const multipleSelected = selectedActionIdsArray.length > 1;

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(true),
    onNewQuiz: newQuiz,
    onToggleMode: () => setMode(mode === "visual" ? "text" : "visual"),
    onEscape: () => {
      setPaletteOpen(false);
      setIdentityOpen(false);
    },
    onExport: handleExport,
    onSelectAll: selectAllActions, // Ctrl+A
  });

  return (
    <div className="jqzz-dash">
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {identityOpen && user && (
        <IdentityModal
          current={user}
          onSave={() => setIdentityOpen(false)}
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
          clearSelectedActions(); // clear selection when switching quizzes
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
        selectedActionIds={selectedActionIds}
        toggleSelectAction={toggleSelectAction}
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
        selectedAction={selectedAction}
        multipleSelected={multipleSelected}
        onActionUpdate={updateAction}
        onQuestionUpdate={updateQuestion}
      />
    </div>
  );
};
