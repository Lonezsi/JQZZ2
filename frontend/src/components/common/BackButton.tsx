import React from "react";
import { go } from "../../hooks/useHashRoute";

/**
 * The way back. A drawn arrow rather than "←", whose glyph sits on the text
 * baseline and never lands in the middle of a round button.
 */
export const BackButton: React.FC<{ to?: string; title?: string; label?: string }> = ({
  to = "/",
  title = "back to the editor",
  label,
}) => (
  <button
    className={`jqzz-play-btn ghost jqzz-back${label ? " labelled" : ""}`}
    onClick={() => go(to)}
    title={title}
    aria-label={label ? undefined : title}
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M13 8H3.5M7.5 3.5 3 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {label}
  </button>
);
