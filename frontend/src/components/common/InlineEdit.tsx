import React, { useLayoutEffect, useRef, useState } from "react";

/**
 * A value you edit where it's shown: click it and it becomes a field of the
 * same size, Enter or clicking away keeps what you typed, Esc puts it back.
 * Clicks stay inside, so the card or plate under it isn't selected or dragged.
 */
export const InlineEdit: React.FC<{
  value: string;
  /** what shows while not editing; the value itself by default */
  children?: React.ReactNode;
  onCommit: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  className?: string;
  "aria-label": string;
  /** told when editing starts and ends, so a draggable parent can stop dragging */
  onEditing?: (editing: boolean) => void;
}> = ({ value, children, onCommit, type = "text", min, max, className = "", onEditing, ...rest }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // a field taken away while focused can still blur: the edit ends once, never twice
  const ended = useRef(false);
  const label = rest["aria-label"];

  useLayoutEffect(() => {
    if (draft !== null) input.current?.select();
    // only when editing starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null]);

  const start = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    ended.current = false;
    setDraft(value);
    onEditing?.(true);
  };
  const end = (keep: boolean) => {
    if (draft === null || ended.current) return;
    ended.current = true;
    if (keep && draft !== value) onCommit(draft);
    setDraft(null);
    onEditing?.(false);
  };

  if (draft === null) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={`jqzz-inline-edit ${className}`}
        aria-label={`${label}: ${value || "empty"}. click to change it`}
        title="click to change it"
        onClick={start}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            start(e);
          }
        }}
      >
        {children ?? value}
      </span>
    );
  }
  return (
    <input
      ref={input}
      className={`jqzz-inline-input ${className}`}
      type={type}
      min={min}
      max={max}
      inputMode={type === "number" ? "numeric" : undefined}
      value={draft}
      aria-label={label}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => end(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          end(true);
        } else if (e.key === "Escape") {
          // ours: Esc puts the value back, and mustn't also close the quiz
          e.preventDefault();
          end(false);
        }
      }}
    />
  );
};
