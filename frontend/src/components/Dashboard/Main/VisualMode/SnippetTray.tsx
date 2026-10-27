import React from "react";
import { useTypes } from "../../../../hooks/useTypes";
import type { TypeShape } from "../../../../types/stash";
import { FALLBACK_TYPES, readType } from "../../../../utils/stashContent";
import { typeLabel } from "../../../../utils/questionInfo";
import { Glyph } from "../../../common/Glyph";

export const DRAG_SNIPPET_KEY = "jqzz-snippet";

interface SnippetTrayProps {
  onPick: (snippetId: string) => void;
}

/**
 * Question types: click one to add a new question of it to the end, or drag
 * it in. They come from your stash, where they can be edited; the built-in
 * ones stand in while it loads.
 */
export const SnippetTray: React.FC<SnippetTrayProps> = ({ onPick }) => {
  const stashed = useTypes();
  const types: TypeShape[] = stashed && stashed.length > 0 ? stashed.map((t) => readType(t)) : FALLBACK_TYPES;
  return (
    <div className="jqzz-tray-grid">
      {types.map((t, i) => {
        const total = t.steps.reduce((sum, step) => sum + step.time, 0);
        const id = `type:${JSON.stringify(t)}`;
        return (
          <button
            key={`${t.name}-${i}`}
            className="jqzz-snippet"
            style={{ "--i": i } as React.CSSProperties}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_SNIPPET_KEY, id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onPick(id)}
            aria-label={`Add ${t.name}: ${t.steps.length} steps, ${total} seconds`}
          >
            <span className="jqzz-snippet-name">
              <Glyph name={t.questionType} size={13} />
              {t.name}
            </span>
            <span className="jqzz-annot">
              {typeLabel(t.questionType)} · {t.steps.length} steps · {total}s
            </span>
            {/* its phases, widths proportional to their time */}
            <span className="jqzz-phase-strip" aria-hidden="true">
              {t.steps.map((step, j) => (
                <span
                  key={j}
                  style={{ flexGrow: Math.max(step.time, 1), background: `var(--phase-${step.phase})` }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
};
