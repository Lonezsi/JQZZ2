import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuiz } from "../../contexts/QuizContext";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { Sidebar } from "./Sidebar/Sidebar";
import { Main } from "./Main/Main";
import { Inspector } from "./Inspector/Inspector";
import { CommandPalette } from "../Modals/CommandPalette";
import { IdentityModal } from "../Modals/IdentityModal";
import { userService } from "../../services/userService";
import { quizService } from "../../services/quizService";
import { Atmosphere, Imperfections } from "../common/Atmosphere";
import { usePresence } from "../../hooks/usePresence";
import { isGuestName } from "../../utils/guestName";
import { useSwipeDrawer } from "../../hooks/useSwipeDrawer";
import { playService } from "../../services/playService";
import { stashService } from "../../services/stashService";
import { convertToBackendQuiz } from "../../utils/quizConverter";
import { errorMessage } from "../../services/api";
import { go } from "../../hooks/useHashRoute";
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
    importScript,
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
    dropOver,
    dragActionId,
    dragOverActionId,
    onDropZoneDragOver,
    onDropZoneDragLeave,
    onDropZoneDrop,
    onActionDragStart,
    onActionDragEnd,
    onActionDragOver,
    onActionDrop,
  } = useDragAndDrop(dropSnippet, reorderActions);

  const [paletteOpen, setPaletteOpen] = useState(false);
  // on a phone the sidebar is a drawer; this is whether it is pulled out
  const [navOpen, setNavOpen] = useState(false);
  useSwipeDrawer(navOpen, setNavOpen);
  const [identityOpen, setIdentityOpen] = useState(false);
  const identityPresence = usePresence(identityOpen, 240);

  // Imports a .txt script as a new quiz
  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      await importScript(file.name.replace(/\.txt$/i, ""), text);
    };
    input.click();
  }, [importScript]);

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

  // the stash copies what the server has, so save the latest edits first
  const handleStash = useCallback(() => {
    if (!quiz || !user) return;
    quizService
      .update(quiz.id, convertToBackendQuiz(quiz))
      .then(() => stashService.fromQuiz(user.id, quiz.id))
      .then(([item]) => {
        if (window.confirm(`saved to your stash as ${item.handle}. open the stash?`)) go("/me/stash");
      })
      .catch((err) => alert(`couldn't stash it: ${errorMessage(err)}`));
  }, [quiz, user]);

  // Determine which action to edit in the right panel
  const selectedActionIdsArray = Array.from(selectedActionIds);
  const firstSelectedId = selectedActionIdsArray[0] ?? null;
  const selectedAction = firstSelectedId
    ? (quiz?.actions.find((a) => a.id === firstSelectedId) ?? null)
    : null;
  const multipleSelected = selectedActionIdsArray.length > 1;

  const handleStart = useCallback(() => {
    if (!quiz) {
      newQuiz();
      return;
    }
    if (!quiz.actions.some((a) => a.question)) {
      alert("this quiz has no questions yet. add one first.");
      return;
    }
    if (!user) return;
    // host a game of it: the big screen opens, people join with its code
    playService
      .host(quiz.id, user.id)
      .then((game) => go(`/host/${game.code}`))
      .catch((err) => alert(`couldn't start it: ${errorMessage(err)}`));
  }, [quiz, newQuiz, user]);

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(true),
    onNewQuiz: newQuiz,
    onToggleMode: () => setMode(mode === "visual" ? "text" : "visual"),
    // one thing at a time: dialog, then palette, then the selection
    onEscape: () => {
      if (navOpen) setNavOpen(false);
      else if (identityOpen) setIdentityOpen(false);
      else if (paletteOpen) setPaletteOpen(false);
      else clearSelectedActions();
    },
    onExport: handleExport,
    onSelectAll: selectAllActions, // Ctrl+A
    onImport: handleImport, // Ctrl+I
    onStart: handleStart, // Ctrl+Enter
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
          if (isGuestName(u.name) && !u.online) {
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
      case "New quiz":
        newQuiz();
        break;
      case "Import a .txt":
        handleImport();
        break;
      case "Export this quiz":
        handleExport();
        break;
      case "Switch visual / text":
        setMode(mode === "visual" ? "text" : "visual");
        break;
      case "Start":
        handleStart();
        break;
      case "Join a game":
        go("/join");
        break;
      case "Stash this quiz":
        handleStash();
        break;
      case "Practice this quiz":
        if (quiz && user) {
          playService
            .practice(user.id, { quizId: quiz.id })
            .then((game) => go(`/play/${game.code}`))
            .catch((err) => alert(`couldn't start it: ${errorMessage(err)}`));
        }
        break;
      case "Open stash":
        go("/me/stash");
        break;
      case "Game history":
        go("/me/history");
        break;
    }
  }, [newQuiz, handleImport, handleExport, handleStart, handleStash, mode, setMode, quiz, user]);

  return (
    <div className="jqzz-app" data-phase={selectedAction?.phase ?? "IDLE"}>
      <Atmosphere />
      <div className="jqzz-dash">
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onExecute={handleCommand}
          quizzes={quizzes}
          onOpenQuiz={(id) => {
            setActiveQuizId(id);
            clearSelectedActions();
          }}
        />
        {identityPresence.mounted && user && (
          <IdentityModal
            state={identityPresence.state}
            current={user}
            onSave={() => setIdentityOpen(false)}
            onClose={() => setIdentityOpen(false)}
          />
        )}

        {/* phone only: dims the page behind the drawer, a tap on it closes it */}
        <div
          className={`jqzz-nav-scrim${navOpen ? " open" : ""}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <Sidebar
          open={navOpen}
          identity={user}
          onIdentityClick={() => setIdentityOpen(true)}
          quizzes={quizzes}
          activeQuizId={activeQuizId}
          onSelectQuiz={(id) => {
            setActiveQuizId(id);
            clearSelectedActions();
            setNavOpen(false);
          }}
          onNewQuiz={() => {
            newQuiz();
            setNavOpen(false);
          }}
          onImport={() => {
            handleImport();
            setNavOpen(false);
          }}
          onHomeClick={() => {
            setActiveQuizId(null);
            setNavOpen(false);
          }}
        />

        <Main
          mode={mode}
          setMode={setMode}
          onOpenPalette={() => setPaletteOpen(true)}
          onMenu={() => setNavOpen(true)}
          onNewQuiz={newQuiz}
          onImport={handleImport}
          onStart={handleStart}
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
          inspector={
            <Inspector
              selectedAction={selectedAction}
              multipleSelected={multipleSelected}
              onActionUpdate={updateAction}
              onQuestionUpdate={updateQuestion}
              onClose={clearSelectedActions}
            />
          }
        />
      </div>
      <Imperfections />
    </div>
  );
};
