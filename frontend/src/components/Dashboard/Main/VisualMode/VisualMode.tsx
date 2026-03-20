import React from "react";
import type { Quiz, Question, RenderItem } from "../../../../types";
import { ActionCard } from "./ActionCard";
import { EmptyState } from "./EmptyState";
import { AddButton } from "./AddButton";

interface VisualModeProps {
  quiz: Quiz | undefined;
  renderItems: RenderItem[];
  questionMap: Map<number, Question>;
  selectedActionIds: Set<number>;
  toggleSelectAction: (id: number, ctrlKey?: boolean) => void;
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
}

export const VisualMode: React.FC<VisualModeProps> = ({
  quiz,
  renderItems,
  questionMap,
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
}) => {
  if (!quiz) {
    return (
      <div style={{ color: "var(--txt3)", fontSize: 12 }}>
        Select a quiz to begin.
      </div>
    );
  }

  if (renderItems.length === 0) {
    return (
      <EmptyState
        dropOver={dropOver}
        onDropZoneDragOver={onDropZoneDragOver}
        onDropZoneDragLeave={onDropZoneDragLeave}
        onDropZoneDrop={onDropZoneDrop}
      />
    );
  }

  return (
    <>
      {renderItems.map((item, idx) => {
        if (item.kind === "divider") {
          return (
            <ActionCard
              key={item.action.id}
              action={item.action}
              isSelected={selectedActionIds.has(item.action.id)}
              isDragging={item.action.id === dragActionId}
              isOver={
                item.action.id === dragOverActionId &&
                dragActionId !== item.action.id
              }
              onToggleSelect={toggleSelectAction}
              onActionDragStart={onActionDragStart}
              onActionDragEnd={onActionDragEnd}
              onActionDragOver={onActionDragOver}
              onActionDrop={onActionDrop}
              deleteAction={deleteAction}
              duplicateAction={duplicateAction}
            />
          );
        }
        if (item.kind === "text") {
          return (
            <ActionCard
              key={item.action.id}
              action={item.action}
              isSelected={selectedActionIds.has(item.action.id)}
              isDragging={item.action.id === dragActionId}
              isOver={
                item.action.id === dragOverActionId &&
                dragActionId !== item.action.id
              }
              onToggleSelect={toggleSelectAction}
              onActionDragStart={onActionDragStart}
              onActionDragEnd={onActionDragEnd}
              onActionDragOver={onActionDragOver}
              onActionDrop={onActionDrop}
              deleteAction={deleteAction}
              duplicateAction={duplicateAction}
            />
          );
        }
        // group
        const q = questionMap.get(item.questionId);
        const qIdx = q ? quiz.questions.indexOf(q) + 1 : "?";
        const qLabel = q
          ? `"${q.text.slice(0, 38)}${q.text.length > 38 ? "…" : ""}"`
          : "Unknown";
        return (
          <div key={`${item.questionId}-${idx}`} className="jqzz-group">
            <div className="jqzz-group-label">
              Q{qIdx} — {qLabel}
            </div>
            {item.actions.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                isSelected={selectedActionIds.has(a.id)}
                isDragging={a.id === dragActionId}
                isOver={a.id === dragOverActionId && dragActionId !== a.id}
                onToggleSelect={toggleSelectAction}
                onActionDragStart={onActionDragStart}
                onActionDragEnd={onActionDragEnd}
                onActionDragOver={onActionDragOver}
                onActionDrop={onActionDrop}
                deleteAction={deleteAction}
                duplicateAction={duplicateAction}
              />
            ))}
          </div>
        );
      })}
      <AddButton
        dropOver={dropOver}
        onDropZoneDragOver={onDropZoneDragOver}
        onDropZoneDragLeave={onDropZoneDragLeave}
        onDropZoneDrop={onDropZoneDrop}
      />
    </>
  );
};
