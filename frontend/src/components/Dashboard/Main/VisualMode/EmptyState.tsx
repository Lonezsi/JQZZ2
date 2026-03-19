import React from "react";

interface EmptyStateProps {
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
}) => {
  return (
    <div className="jqzz-empty-state">
      <div className="jqzz-empty-icon">◈</div>
      <div className="jqzz-empty-title">No actions yet</div>
      <div className="jqzz-empty-sub">
        Click a snippet in the sidebar to add it,
        <br />
        or drag one here.
      </div>
      <div
        className={`jqzz-empty-drop${dropOver ? " over" : ""}`}
        onDragOver={onDropZoneDragOver}
        onDragLeave={onDropZoneDragLeave}
        onDrop={onDropZoneDrop}
      >
        {dropOver ? "✦ Release to add" : "↓ Drop snippet here"}
      </div>
    </div>
  );
};
