import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuiz } from "../../contexts/QuizContext";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { Sidebar } from "./Sidebar/Sidebar";
import { Main } from "./Main/Main";
import { Inspector } from "./Inspector/Inspector";
import { CommandPalette } from "../Modals/CommandPalette";
import { IdentityModal } from "../Modals/IdentityModal";
import { AiQuizDialog } from "../Modals/AiQuizDialog";
import { quizService } from "../../services/quizService";
import { Imperfections } from "../common/Atmosphere";
import { useSpace } from "../../hooks/useSpace";
import { usePresence } from "../../hooks/usePresence";
import { useSwipeDrawer } from "../../hooks/useSwipeDrawer";
import { playService } from "../../services/playService";
import { stashService } from "../../services/stashService";
import { convertToBackendQuiz } from "../../utils/quizConverter";
import { errorMessage } from "../../services/api";
import { go } from "../../hooks/useHashRoute";
import { useEscape } from "../../hooks/useEscape";
import { COMMANDS } from "../../constants/commands";
import { ROSTER_EVENT } from "./Main/RosterCard";
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

  // the list is yours: other people's quizzes only reach you through a link
  // or the stash, and stay listed while one of them is open
  const mine = useMemo(
    () => quizzes.filter((q) => q.authorId === user?.id || q.id === activeQuizId),
    [quizzes, user?.id, activeQuizId],
  );

  const dropSnippet = useCallback(
    (snippetId: string, at?: number) => {
      dropSnippetMutation(snippetId, at);
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
  // making a quiz with a chat AI: from the sidebar, the front page or its key
  const [aiOpen, setAiOpen] = useState(false);

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
  // the front page is where you land; opening a quiz moves you to the editor
  useSpace(quiz ? "editor" : "front", selectedAction?.phase ?? "IDLE");

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

  // Esc, one thing at a time (hooks/useEscape.ts): what was opened last goes
  // first, and with the quiz closed too it goes back
  useEscape(!!quiz, () => setActiveQuizId(null));
  useEscape(selectedActionIds.size > 0, clearSelectedActions);
  useEscape(navOpen, () => setNavOpen(false));

  const handleCommand = useCallback((label: string) => {
    const to = COMMANDS.find((c) => c.label === label)?.to;
    if (to) {
      go(to);
      return;
    }
    switch (label) {
      case "New quiz":
        newQuiz();
        break;
      case "Import a .txt":
        handleImport();
        break;
      case "Make a quiz with AI":
        setAiOpen(true);
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
      case "Who's coming":
        if (quiz) window.dispatchEvent(new Event(ROSTER_EVENT));
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
    }
  }, [newQuiz, handleImport, handleExport, handleStart, handleStash, mode, setMode, quiz, user]);

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(true),
    onSelectAll: selectAllActions,
    onCommand: handleCommand,
  });

  return (
    <div className="jqzz-app" data-phase={selectedAction?.phase ?? "IDLE"}>
      <div className="jqzz-dash">
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onExecute={handleCommand}
          quizzes={mine}
          onOpenQuiz={(id) => {
            setActiveQuizId(id);
            clearSelectedActions();
          }}
        />
        {aiOpen && <AiQuizDialog onClose={() => setAiOpen(false)} />}
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
          quizzes={mine}
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
          onMakeWithAI={() => {
            setAiOpen(true);
            setNavOpen(false);
          }}
          onHomeClick={() => {
            setActiveQuizId(null);
            setNavOpen(false);
          }}
          onClose={() => setNavOpen(false)}
        />

        <Main
          mode={mode}
          setMode={setMode}
          onOpenPalette={() => setPaletteOpen(true)}
          onMenu={() => setNavOpen(true)}
          onNewQuiz={newQuiz}
          onImport={handleImport}
          onMakeWithAI={() => setAiOpen(true)}
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
