import React from "react";
import { SnippetTray } from "./SnippetTray";

interface EmptyStateProps {
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
  onPick: (snippetId: string) => void;
  onTextMode: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onPick,
  onTextMode,
}) => {
  return (
    <div
      className={`jqzz-empty-state jqzz-view-in${dropOver ? " over" : ""}`}
      onDragOver={onDropZoneDragOver}
      onDragLeave={onDropZoneDragLeave}
      onDrop={onDropZoneDrop}
    >
      <div className="jqzz-halftone jqzz-empty-dots" aria-hidden="true" />
      <div className="jqzz-empty-title jqzz-chroma">nothing here yet</div>
      <div className="jqzz-empty-sub">
        start with one of these, or{" "}
        <button className="jqzz-link-btn" onClick={onTextMode}>
          write it out in text mode
        </button>
        .
      </div>
      <SnippetTray onPick={onPick} />
    </div>
  );
};
