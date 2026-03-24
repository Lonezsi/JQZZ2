import React from "react";
import type { Quiz, RenderItem } from "../../../../types";
import { ActionCard } from "./ActionCard";
import { EmptyState } from "./EmptyState";
import { AddButton } from "./AddButton";
import { Welcome } from "../../Welcome/Welcome";

interface VisualModeProps {
  quiz: Quiz | undefined;
  renderItems: RenderItem[];
  selectedActionIds: Set<number>;
  toggleSelectAction: (
    id: number,
    ctrlKey?: boolean,
    shiftKey?: boolean,
  ) => void;
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
    return <Welcome />;
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

  // Compute question numbers dynamically
  let questionNumber = 0;
  let lastQuestionId: number | null = null;

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
        const q = item.question;
        if (q.id !== lastQuestionId) {
          questionNumber++;
          lastQuestionId = q.id;
        }
        const truncatedText =
          q.text.length > 38 ? `${q.text.slice(0, 38)}…` : q.text;
        return (
          <div key={`${q.id}-${idx}`} className="jqzz-group">
            <div className="jqzz-group-label">
              Q{questionNumber} — "{truncatedText}"
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
