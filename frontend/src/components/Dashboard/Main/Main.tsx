// src/components/Dashboard/Main/Main.tsx
import React from "react";
import { Toolbar } from "./Toolbar";
import { VisualMode } from "./VisualMode/VisualMode";
import { TextMode } from "./TextMode/TextMode";
import { useQuiz } from "../../../contexts/QuizContext";
import type { EditorMode, Question, Action } from "../../../types";

interface MainProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  onOpenPalette: () => void;
  onExport: () => void;
  selectedActionId: number | null;
  setSelectedActionId: (id: number | null) => void;
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
}

export const Main: React.FC<MainProps> = ({
  mode,
  setMode,
  onOpenPalette,
  onExport,
  selectedActionId,
  setSelectedActionId,
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
}) => {
  const { quiz, renderItems, questionMap } = useQuiz();

  return (
    <main className="jqzz-main">
      <Toolbar
        mode={mode}
        setMode={setMode}
        onOpenPalette={onOpenPalette}
        onExport={onExport}
      />

      <div
        className="jqzz-body"
        onDragOver={mode === "visual" ? onDropZoneDragOver : undefined}
        onDragLeave={mode === "visual" ? onDropZoneDragLeave : undefined}
        onDrop={mode === "visual" ? onDropZoneDrop : undefined}
      >
        {mode === "visual" ? (
          <VisualMode
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
    </main>
  );
};
