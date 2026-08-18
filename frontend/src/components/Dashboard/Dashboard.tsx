import React, { useState, useCallback, useEffect } from "react";
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
import { userService } from "../../services/userService";
import { quizService } from "../../services/quizService";
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

  useEffect(() => {
    // Run cleanup every hour
    const cleanupInterval = setInterval(async () => {
      if (!user) return; // wait until user is loaded

      try {
        // Fetch all users and all quizzes
        const [usersRes, quizzesRes] = await Promise.all([
          userService.getAll(),
          quizService.getAll(),
        ]);

        const allUsers = usersRes.data;
        const allQuizzes = quizzesRes.data;

        // Build a map of authorId -> count of quizzes
        const quizCountByAuthor = new Map<string, number>();
        for (const quiz of allQuizzes) {
          quizCountByAuthor.set(
            quiz.authorId,
            (quizCountByAuthor.get(quiz.authorId) || 0) + 1,
          );
        }

        // Delete offline guest users with no quizzes
        for (const u of allUsers) {
          if (u.id === user.id) continue; // never delete current user
          if (u.name.startsWith("Guest_") && !u.online) {
            const hasQuizzes = quizCountByAuthor.has(u.id);
            if (!hasQuizzes) {
              await userService.delete(u.id);
              console.log(`Deleted guest user ${u.id} (${u.name})`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to clean up guest users", err);
      }
    }, 3600000); // 1 hour

    return () => clearInterval(cleanupInterval);
  }, [user]);

  const handleCommand = useCallback((label: string) => {
    switch (label) {
      case "New Quiz":
        newQuiz();
        break;
      case "Export Current Quiz":
        handleExport();
        break;
      case "Toggle Text Mode":
        setMode(mode === "visual" ? "text" : "visual");
        break;
      default:
        console.log("Unhandled command:", label);
    }
  }, [newQuiz, handleExport, mode, setMode]);

  return (
    <div className="surface-imperfection-light-full">
      <div className="surface-imperfection-light-scratch">
        <div className="jqzz-dash surface surface-imperfection-floor">
          {paletteOpen && (
            <CommandPalette onClose={() => setPaletteOpen(false)} onExecute={handleCommand} />
          )}
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
              clearSelectedActions();
            }}
            onNewQuiz={newQuiz}
            onImport={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".txt";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const text = await file.text();
                import("../../utils/scriptParser").then(({ parseScript }) => {
                  const existingQuestions = quiz?.actions
                    .map((a) => a.question)
                    .filter(Boolean) ?? [];
                  const { questions, actions, errors } = parseScript(text, existingQuestions);
                  if (errors.length > 0) {
                    console.warn("Parse errors:", errors);
                  }
                  handleParsed(questions, actions);
                });
              };
              input.click();
            }}
            onJoinLobby={() => alert("Lobby list not implemented yet")}
            snippets={SNIPPETS}
            draggingSnippet={draggingSnippet}
            onSnippetDragStart={onSnippetDragStart}
            onSnippetDragEnd={onSnippetDragEnd}
            onSnippetClick={dropSnippet}
            onHomeClick={() => setActiveQuizId(null)}
          />

          <Main
            mode={mode}
            setMode={setMode}
            onOpenPalette={() => setPaletteOpen(true)}
            onExport={handleExport}
            onStart={() => {
              if (!quiz) {
                newQuiz();
                return;
              }
              if (quiz.actions.length === 0) {
                alert("Quiz has no actions yet. Add some questions first!");
                return;
              }
              setMode("visual");
              setPaletteOpen(true);
            }}
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
      </div>
    </div>
  );
};
