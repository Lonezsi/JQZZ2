import React, { useState } from "react";

/*
 * The line between the script and the reference: drag it to give either more
 * room. The width is the reference's, kept per browser; null is the default
 * (CSS: min(480px, 42%)). Arrow keys move it too, a double click resets it.
 */

const DOCS_LEAST = 280;
const SCRIPT_LEAST = 360;
const STEP = 24;

/** the reference's width with the split this wide, kept inside what both sides need */
const clamp = (w: number, splitWidth: number) =>
  Math.max(DOCS_LEAST, Math.min(w, splitWidth - SCRIPT_LEAST));

export const SplitHandle: React.FC<{
  width: number | null;
  onWidth: (w: number | null) => void;
}> = ({ width, onWidth }) => {
  const [dragging, setDragging] = useState(false);

  const current = (handle: HTMLElement) =>
    width ??
    (handle.nextElementSibling as HTMLElement | null)?.offsetWidth ??
    480;

  return (
    <div
      className={`jqzz-text-resize${dragging ? " dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="resize the reference"
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      title="drag to resize, double click to reset"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const handle = e.currentTarget;
        const split = handle.parentElement;
        if (!split) return;
        handle.setPointerCapture(e.pointerId);
        setDragging(true);
        const move = (ev: PointerEvent) => {
          const r = split.getBoundingClientRect();
          onWidth(
            clamp(r.right - ev.clientX - handle.offsetWidth / 2, r.width),
          );
        };
        const up = () => {
          setDragging(false);
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      }}
      onDoubleClick={() => onWidth(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const split = e.currentTarget.parentElement;
        if (!split) return;
        const by = e.key === "ArrowLeft" ? STEP : -STEP;
        onWidth(clamp(current(e.currentTarget) + by, split.offsetWidth));
      }}
    />
  );
};
