import React from "react";
import type { Action } from "../../../../types";

interface ActionCardProps {
  action: Action;
  isSelected: boolean;
  isDragging: boolean;
  isOver: boolean;
  onSelect: (id: number | null) => void;
  onActionDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDragEnd: () => void;
  onActionDragOver: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDrop: (e: React.DragEvent<HTMLDivElement>, dropId: number) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  isSelected,
  isDragging,
  isOver,
  onSelect,
  onActionDragStart,
  onActionDragEnd,
  onActionDragOver,
  onActionDrop,
  deleteAction,
  duplicateAction,
}) => {
  if (action.phase === "DIVIDER") {
    return (
      <div
        key={action.id}
        className={`jqzz-divider-block${isSelected ? " selected" : ""}`}
        onClick={() => onSelect(action.id)}
        draggable
        onDragStart={(e) => onActionDragStart(e, action.id)}
        onDragEnd={onActionDragEnd}
        onDragOver={(e) => onActionDragOver(e, action.id)}
        onDrop={(e) => onActionDrop(e, action.id)}
      >
        <span style={{ color: "var(--txt3)", fontSize: 10, cursor: "grab" }}>
          ⠿
        </span>
        <div className="jqzz-divider-line" />
        <span className="jqzz-divider-label">DIVIDER</span>
        <div className="jqzz-divider-line" />
        <button
          className="jqzz-card-action-btn del"
          onClick={(e) => {
            e.stopPropagation();
            deleteAction(action.id);
          }}
          style={{ opacity: 0.6, marginLeft: 4 }}
        >
          ✕
        </button>
      </div>
    );
  }

  if (action.phase === "TEXT") {
    return (
      <div
        key={action.id}
        className={`jqzz-text-block${isSelected ? " selected" : ""}${isDragging ? " dragging-self" : ""}${isOver ? " drag-over" : ""}`}
        onClick={() => onSelect(action.id)}
        onDragOver={(e) => onActionDragOver(e, action.id)}
        onDrop={(e) => onActionDrop(e, action.id)}
      >
        <div
          className="jqzz-drag-handle"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            onActionDragStart(e, action.id);
          }}
          onDragEnd={onActionDragEnd}
        >
          ⠿
        </div>
        <span style={{ color: "var(--txt3)", fontSize: 10, marginRight: 4 }}>
          ✎
        </span>
        <span className="jqzz-text-block-content">
          {action.preview || "empty note"}
        </span>
        <span
          className="jqzz-card-actions"
          style={{ opacity: 1, marginLeft: "auto", display: "flex", gap: 4 }}
        >
          <button
            className="jqzz-card-action-btn del"
            onClick={(e) => {
              e.stopPropagation();
              deleteAction(action.id);
            }}
          >
            ✕
          </button>
        </span>
      </div>
    );
  }

  return (
    <div
      key={action.id}
      className={`jqzz-card${isSelected ? " selected" : ""}${isDragging ? " dragging-self" : ""}${isOver ? " drag-over" : ""}`}
      onClick={() => onSelect(action.id)}
      onDragOver={(e) => onActionDragOver(e, action.id)}
      onDrop={(e) => onActionDrop(e, action.id)}
    >
      <div
        className="jqzz-drag-handle"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onActionDragStart(e, action.id);
        }}
        onDragEnd={onActionDragEnd}
        title="Drag to reorder"
      >
        ⠿
      </div>
      <span className={`jqzz-phase-badge badge-${action.phase}`}>
        {action.phase}
      </span>
      <span className="jqzz-card-time">{action.time}s</span>
      <span className="jqzz-card-preview">{action.preview}</span>
      <span className="jqzz-card-actions">
        <button
          className="jqzz-card-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            duplicateAction(action.id);
          }}
          title="Duplicate"
        >
          ⧉
        </button>
        <button
          className="jqzz-card-action-btn del"
          onClick={(e) => {
            e.stopPropagation();
            deleteAction(action.id);
          }}
          title="Delete"
        >
          ✕
        </button>
      </span>
    </div>
  );
};
