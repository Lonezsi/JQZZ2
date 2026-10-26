import React from "react";
import { SNIPPETS } from "../../../../constants/snippets";

export const DRAG_SNIPPET_KEY = "jqzz-snippet";

interface SnippetTrayProps {
  onPick: (snippetId: string) => void;
}

/** The snippet library: click one to add it to the end, or drag it in. */
export const SnippetTray: React.FC<SnippetTrayProps> = ({ onPick }) => (
  <div className="jqzz-tray-grid">
    {SNIPPETS.map((s, i) => {
      const total = s.steps.reduce((sum, step) => sum + step.time, 0);
      return (
        <button
          key={s.id}
          className="jqzz-snippet"
          style={{ "--i": i } as React.CSSProperties}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_SNIPPET_KEY, s.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onPick(s.id)}
          aria-label={`Add ${s.name}: ${s.steps.length} steps, ${total} seconds`}
        >
          <span className="jqzz-snippet-name">{s.name}</span>
          <span className="jqzz-annot">
            {s.steps.length} steps · {total}s
          </span>
          {/* its phases, widths proportional to their time */}
          <span className="jqzz-phase-strip" aria-hidden="true">
            {s.steps.map((step, j) => (
              <span
                key={j}
                style={{ flexGrow: step.time, background: `var(--phase-${step.phase})` }}
              />
            ))}
          </span>
        </button>
      );
    })}
  </div>
);
