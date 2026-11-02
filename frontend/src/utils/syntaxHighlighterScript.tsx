import React, { useMemo } from "react";
import { analyze, type Piece } from "./scriptInsight";

const pieceClass = (p: Piece) =>
  p.kind === "bracket"
    ? `br br-${p.role ?? "other"}${p.bad ? " bad" : ""}${p.lit ? " lit" : ""}`
    : `t-${p.kind}`;

/**
 * The script, coloured, under the transparent textarea it mirrors. Every
 * character here sits exactly where it sits in the textarea; the hints only
 * ever come after the end of a line, so they never push anything along.
 */
export const HighlightedScript: React.FC<{ text: string; caret?: number | null }> = ({ text, caret = null }) => {
  const lines = useMemo(() => analyze(text, caret), [text, caret]);
  return (
    <>
      {lines.map((line, li) => (
        <span key={li} className="jqzz-hl-line">
          {line.pieces.map((p, pi) => (
            <span
              key={pi}
              className={pieceClass(p)}
              style={p.phase ? ({ "--br": `var(--phase-${p.phase})` } as React.CSSProperties) : undefined}
            >
              {p.v}
            </span>
          ))}
          {line.pieces.length === 0 && " "}
          {line.hint && (
            <span className={`jqzz-hint ${line.hint.tone}`} aria-hidden="true">
              {line.hint.text}
            </span>
          )}
        </span>
      ))}
    </>
  );
};
