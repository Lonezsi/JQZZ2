import React, { useEffect, useRef, useState } from "react";
import type { Action, Question } from "../../../types";
import { ContextEditor } from "./ContextEditor";
import { useQuiz } from "../../../contexts/QuizContext";
import { usePresence } from "../../../hooks/usePresence";
import { actionStartTimes, formatTimecode } from "../../../utils/timecode";

interface InspectorProps {
  selectedAction: Action | null;
  multipleSelected: boolean;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
  onClose: () => void;
}

/** Floats over the canvas while something is selected; gone otherwise. */
export const Inspector: React.FC<InspectorProps> = ({
  selectedAction,
  multipleSelected,
  onActionUpdate,
  onQuestionUpdate,
  onClose,
}) => {
  const { quiz, selectedActionIds } = useQuiz();
  const { mounted, state } = usePresence(selectedAction !== null, 300);

  /* On a phone this is a sheet: drag its top down to put it away. It follows
     the finger, then either drops out of sight or springs back. */
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; dy: number; lastY: number; lastT: number; v: number } | null>(
    null,
  );
  // opening again (another card picked mid-exit) brings a dragged-away sheet back
  useEffect(() => {
    if (state === "open") sheetRef.current?.style.removeProperty("transform");
  }, [state]);
  const onGrab = (e: React.PointerEvent) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    if ((e.target as Element).closest("button")) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks; the drag still works without capture */
    }
    drag.current = { y: e.clientY, dy: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    if (sheetRef.current) sheetRef.current.dataset.drag = "1";
  };
  const onDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    // upward gives a little, like pulling on something held at the bottom
    const raw = e.clientY - d.y;
    d.dy = raw > 0 ? raw : raw / 4;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    sheet.style.transform = `translateY(${d.dy}px)`;
  };
  const onDrop = () => {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    delete sheet.dataset.drag;
    if (d.dy > sheet.offsetHeight * 0.28 || d.v > 0.5) {
      sheet.style.transform = "translateY(105%)";
      onClose();
    } else {
      sheet.style.removeProperty("transform");
    }
  };

  // keep the last action on screen while the panel slides away
  const [shown, setShown] = useState<Action | null>(selectedAction);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedAction) setShown(selectedAction);
  }, [selectedAction]);

  const action = selectedAction ?? shown;
  if (!mounted || !action) return null;

  const idx = quiz?.actions.findIndex((a) => a.id === action.id) ?? -1;
  const start = quiz ? (actionStartTimes(quiz.actions).get(action.id) ?? 0) : 0;
  const total = quiz?.actions.length ?? 0;

  return (
    <aside
      ref={sheetRef}
      className="jqzz-inspector jqzz-holo is-glass"
      data-state={state}
      aria-label="Inspector"
    >
      <div className="jqzz-holo-dots" aria-hidden="true" />
      <header
        className="jqzz-insp-head"
        onPointerDown={onGrab}
        onPointerMove={onDrag}
        onPointerUp={onDrop}
        onPointerCancel={onDrop}
      >
        <span className="jqzz-sheet-grip" aria-hidden="true" />
        <div className="jqzz-insp-title">
          <span className={`jqzz-phase-badge badge-${action.phase}`}>
            {multipleSelected ? `${selectedActionIds.size} selected` : action.phase.toLowerCase()}
          </span>
          {!multipleSelected && idx >= 0 && (
            <span className="jqzz-annot">
              {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · t+
              {formatTimecode(start)}
            </span>
          )}
        </div>
        <button className="jqzz-icon-btn" onClick={onClose} aria-label="Close" title="close · esc">
          ✕
        </button>
      </header>
      {/* keyed, so moving to another card crossfades the fields */}
      <div className="jqzz-insp-body" key={multipleSelected ? "many" : action.id}>
        {multipleSelected ? (
          <p className="jqzz-panel-hint">click just one card to edit it.</p>
        ) : (
          <ContextEditor
            action={action}
            question={action.question ?? null}
            onActionUpdate={onActionUpdate}
            onQuestionUpdate={onQuestionUpdate}
          />
        )}
      </div>
    </aside>
  );
};
