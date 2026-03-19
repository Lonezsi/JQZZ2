import React from "react";
import type { Snippet } from "../../../types";

interface SnippetListProps {
  snippets: Snippet[];
  draggingSnippet: string | null;
  onSnippetDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onSnippetDragEnd: () => void;
  onSnippetClick: (id: string) => void;
}

export const SnippetList: React.FC<SnippetListProps> = ({
  snippets,
  draggingSnippet,
  onSnippetDragStart,
  onSnippetDragEnd,
  onSnippetClick,
}) => {
  return (
    <div
      className="jqzz-sid-section"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="jqzz-sid-label">
        Snippets{" "}
        <span style={{ opacity: 0.4, fontSize: 9, letterSpacing: 0 }}>
          click or drag ↓
        </span>
      </div>
      {snippets.map((s) => (
        <div
          key={s.id}
          className={`jqzz-snippet-item${draggingSnippet === s.id ? " dragging" : ""}`}
          draggable
          onDragStart={(e) => onSnippetDragStart(e, s.id)}
          onDragEnd={onSnippetDragEnd}
          onClick={() => onSnippetClick(s.id)}
          title={`${s.steps.length} actions`}
        >
          <span className="jqzz-quiz-dot" style={{ background: s.color }} />
          <span className="jqzz-quiz-name">{s.name}</span>
          <span style={{ fontSize: 9, color: "var(--txt3)", flexShrink: 0 }}>
            {s.steps.length}×
          </span>
        </div>
      ))}
    </div>
  );
};
