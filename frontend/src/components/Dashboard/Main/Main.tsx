import React, { useCallback, useEffect, useRef } from "react";
import { useDragAutoScroll } from "../../../hooks/useDragAutoScroll";
import { Toolbar } from "./Toolbar";
import { VisualMode } from "./VisualMode/VisualMode";
import { TextMode } from "./TextMode/TextMode";
import { useQuiz } from "../../../contexts/QuizContext";
import type { EditorMode, Question, Action } from "../../../types";
import {
  actionStartTimes,
  formatTimecode,
  questionCount,
  quizCode,
  quizRuntime,
} from "../../../utils/timecode";

interface MainProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  onOpenPalette: () => void;
  /** phone only: pulls the sidebar out */
  onMenu: () => void;
  onNewQuiz: () => void;
  onImport: () => void;
  selectedActionIds: Set<number>;
  toggleSelectAction: (id: number, ctrlKey?: boolean, shiftKey?: boolean) => void;
  dragActionId: number | null;
  dragOverActionId: number | null;
  onActionDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDragEnd: () => void;
  onActionDragOver: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDrop: (e: React.DragEvent<HTMLDivElement>, dropId: number) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  onParsed: (questions: Question[], actions: Action[]) => void;
  onStart: () => void;
  /** floating editor, rendered over the canvas */
  inspector: React.ReactNode;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const Main: React.FC<MainProps> = ({
  mode,
  setMode,
  onOpenPalette,
  onMenu,
  onNewQuiz,
  onImport,
  selectedActionIds,
  toggleSelectAction,
  dragActionId,
  dragOverActionId,
  onActionDragStart,
  onActionDragEnd,
  onActionDragOver,
  onActionDrop,
  deleteAction,
  duplicateAction,
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  aiPrompt,
  setAiPrompt,
  onParsed,
  onStart,
  inspector,
}) => {
  const { quiz, renderItems, saveState } = useQuiz();

  // margin notes: everything here is read off the quiz itself
  const actions = quiz?.actions ?? [];
  const starts = actionStartTimes(actions);
  const selectedIdx = actions
    .map((a, i) => (selectedActionIds.has(a.id) ? i : -1))
    .filter((i) => i >= 0);
  const hasSelection = selectedIdx.length > 0;
  const first = hasSelection ? actions[selectedIdx[0]] : null;
  const last = hasSelection ? actions[selectedIdx[selectedIdx.length - 1]] : null;
  const windowStart = first ? (starts.get(first.id) ?? 0) : 0;
  const windowEnd = last ? (starts.get(last.id) ?? 0) + (last.time || 0) : 0;
  const showNotes = !!quiz && mode === "visual" && actions.length > 0;

  /* Where the content meets the toolbar: once something has scrolled under it,
     the edge fades instead of cutting, and a thin glow marks the line. Written
     straight onto the element, so scrolling never re-renders anything. */
  const mainRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useDragAutoScroll(bodyRef);
  const markEdges = useCallback(() => {
    const body = bodyRef.current;
    const main = mainRef.current;
    if (!body || !main) return;
    const under = body.scrollTop > 2;
    const more = body.scrollTop + body.clientHeight < body.scrollHeight - 2;
    if (under) main.dataset.under = "1";
    else delete main.dataset.under;
    if (more) main.dataset.more = "1";
    else delete main.dataset.more;
  }, []);
  // a new quiz or mode changes how much there is to scroll
  useEffect(() => {
    markEdges();
  }, [markEdges, quiz?.id, mode, actions.length]);

  return (
    <main className="jqzz-main" ref={mainRef}>
      <Toolbar
        mode={mode}
        setMode={setMode}
        onOpenPalette={onOpenPalette}
        onMenu={onMenu}
        onStart={onStart}
        quiz={quiz}
        saveState={quiz ? saveState : undefined}
      />

      <div className={`jqzz-canvas${hasSelection && mode === "visual" ? " has-inspector" : ""}`}>
        {showNotes && (
          <div className="jqzz-notes" aria-hidden="true">
            <span className="jqzz-annot jqzz-note-tl">
              {quizCode(quiz.id)}
              <br />
              {questionCount(quiz)} questions
            </span>
            <span className="jqzz-annot jqzz-note-vert">
              quiz log : {quizCode(quiz.id)} — Σt {formatTimecode(quizRuntime(quiz))} —{" "}
              {actions.length} actions
            </span>
            <span className={`jqzz-annot jqzz-note-tr${hasSelection ? " on" : ""}`}>
              {hasSelection ? `${pad(selectedIdx[0] + 1)} / ${pad(actions.length)}` : ""}
            </span>
            <span className={`jqzz-annot jqzz-note-bl${hasSelection ? " on" : ""}`}>
              {hasSelection && (
                <>
                  ( t+{formatTimecode(windowStart)} )
                  <br />↓<br />( t+{formatTimecode(windowEnd)} )
                </>
              )}
            </span>
          </div>
        )}

        <div
          ref={bodyRef}
          onScroll={markEdges}
          className={`jqzz-body${showNotes ? " with-notes" : ""}`}
          onDragOver={mode === "visual" ? onDropZoneDragOver : undefined}
          onDragLeave={mode === "visual" ? onDropZoneDragLeave : undefined}
          onDrop={mode === "visual" ? onDropZoneDrop : undefined}
        >
          {mode === "visual" || !quiz ? (
            <VisualMode
              quiz={quiz}
              renderItems={renderItems}
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
              onNewQuiz={onNewQuiz}
              onImport={onImport}
            />
          ) : (
            <TextMode
              quiz={quiz}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              onParsed={onParsed}
            />
          )}
        </div>

        {mode === "visual" && inspector}
      </div>
    </main>
  );
};
