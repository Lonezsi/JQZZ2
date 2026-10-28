import React, { useEffect, useRef, useState } from "react";
import type { Action } from "../../../../types";
import { resolveImage } from "../../../common/Avatar";
import { useAuth } from "../../../../contexts/AuthContext";
import { useQuiz } from "../../../../contexts/QuizContext";
import { describe, parseSettings } from "../../../../utils/settings";
import { formatTimecode } from "../../../../utils/timecode";
import { Glyph } from "../../../common/Glyph";
import { maxPoints, typeLabel } from "../../../../utils/questionInfo";
import { DRAG_IMAGE_KEY, dragging } from "../../../../utils/dragKeys";
import { imageSlots, placeImage } from "../../../../utils/imageSlots";
import type { ImageSlot } from "../../../../utils/imageSlots";
import { QuestionImage } from "../../../Play/PlayCommon";

interface ActionCardProps {
  action: Action;
  /** seconds into the quiz where this action starts */
  start: number;
  /** longest step in the quiz, for the duration bar */
  maxTime: number;
  isSelected: boolean;
  isDragging: boolean;
  isOver: boolean;
  onToggleSelect: (id: number, ctrlKey?: boolean, shiftKey?: boolean) => void;
  onActionDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDragEnd: () => void;
  onActionDragOver: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDrop: (e: React.DragEvent<HTMLDivElement>, dropId: number) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  /** one step up or down, for touch screens where nothing can be dragged */
  onMove?: (id: number, dir: -1 | 1) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

/** The question's picture, out of focus behind its card. */
function Backdrop({ src }: { src?: string }) {
  const { user } = useAuth();
  const { quiz } = useQuiz();
  const [url, setUrl] = useState<string | null>(null);
  const viewer = user?.id ?? "";
  const owner = quiz?.authorId ?? viewer;
  useEffect(() => {
    let cancelled = false;
    if (!src || !viewer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    resolveImage(src, owner, viewer).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [src, owner, viewer]);
  if (!url) return null;
  return <img className="jqzz-card-backdrop" src={url} alt="" aria-hidden="true" />;
}

/**
 * While a picture is dragged over a step: its slots, each named, showing the
 * picture already in it. Dropped on a slot, the picture goes there.
 */
function ImageSlots({ slots, onPlace }: { slots: ImageSlot[]; onPlace: (slot: string, ref: string) => void }) {
  const { user } = useAuth();
  const { quiz } = useQuiz();
  const [over, setOver] = useState<string | null>(null);
  const viewer = user?.id ?? "";
  return (
    <div className="jqzz-img-slots" style={{ "--n": Math.min(slots.length, 5) } as React.CSSProperties}>
      {slots.map((slot, i) => (
        <div
          key={slot.key}
          className={`jqzz-img-slot${over === slot.key ? " over" : ""}${slot.src ? " filled" : ""}`}
          style={{ "--i": i } as React.CSSProperties}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
            setOver(slot.key);
          }}
          onDragLeave={() => setOver((o) => (o === slot.key ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const ref = e.dataTransfer.getData(DRAG_IMAGE_KEY);
            if (ref) onPlace(slot.key, ref);
          }}
        >
          {slot.src && (
            <QuestionImage src={slot.src} ownerId={quiz?.authorId ?? viewer} viewerId={viewer} className="jqzz-img-slot-pic" />
          )}
          <span className="jqzz-img-slot-name">{slot.label}</span>
        </div>
      ))}
    </div>
  );
}

/** a phone, where the inspector is a sheet over the bottom of the screen */
const PHONE = "(max-width: 760px)";

/** What players see during this phase, as a one-line preview. */
function PhasePreview({ action }: { action: Action }) {
  const q = action.question;
  switch (action.phase) {
    case "WAITING": {
      const ticks = Math.min(Math.max(action.time, 1), 30);
      return (
        <span className="jqzz-prev">
          <span className="jqzz-ticks" aria-hidden="true">
            {Array.from({ length: ticks }, (_, i) => (
              <span key={i} />
            ))}
          </span>
          <span className="jqzz-prev-note">countdown, nothing on screen yet</span>
        </span>
      );
    }
    case "QUESTION": {
      // the prompt is already on the plate above; say what's on screen around it
      const written = q?.type?.startsWith("USER_GENERATED");
      const options = q?.answers?.length ?? 0;
      return (
        <span className="jqzz-prev">
          <span className="jqzz-type-pill">
            <Glyph name={q?.type ?? "PREWRITTEN_SINGLE"} size={12} />
            {typeLabel(q?.type)}
          </span>
          <span className="jqzz-prev-note">
            {!q?.text
              ? "no prompt yet"
              : written
                ? "prompt on screen, players type"
                : `prompt + ${options} ${options === 1 ? "option" : "options"} to pick`}
          </span>
          {q?.imageUrl && <span className="jqzz-prev-note">· with image</span>}
        </span>
      );
    }
    case "ANSWER": {
      const answers = q?.answers ?? [];
      if (answers.length === 0) {
        return <span className="jqzz-prev jqzz-prev-warn">no answers yet</span>;
      }
      return (
        <span className="jqzz-prev">
          {answers.slice(0, 4).map((a) => (
            <span key={a.id} className={`jqzz-ans-chip${(a.value || 0) > 0 ? " scores" : ""}`}>
              {a.text || "…"}
              <b>{a.value}</b>
            </span>
          ))}
          {answers.length > 4 && <span className="jqzz-prev-note">+{answers.length - 4} more</span>}
        </span>
      );
    }
    case "ELABORATION":
      return q?.elaborationText ? (
        <span className="jqzz-prev jqzz-prev-quote">“{q.elaborationText}”</span>
      ) : (
        <span className="jqzz-prev jqzz-prev-warn">nothing written to explain it yet</span>
      );
    case "RESULT": {
      const max = maxPoints(q);
      return (
        <span className="jqzz-prev">
          <span className="jqzz-prev-note">leaderboard</span>
          {max !== null && <span className="jqzz-pts">up to {max} pts</span>}
        </span>
      );
    }
    default:
      return null;
  }
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  start,
  maxTime,
  isSelected,
  isDragging,
  isOver,
  onToggleSelect,
  onActionDragStart,
  onActionDragEnd,
  onActionDragOver,
  onActionDrop,
  deleteAction,
  duplicateAction,
  onMove,
  isFirst = false,
  isLast = false,
}) => {
  // on a phone, a card that gets picked scrolls up so the sheet does not cover it
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isSelected || !window.matchMedia(PHONE).matches) return;
    // a frame later, once the timeline has its room for the sheet below it
    const raf = requestAnimationFrame(() =>
      rowRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
    return () => cancelAnimationFrame(raf);
  }, [isSelected]);

  const { updateQuestion } = useQuiz();
  const [imageOver, setImageOver] = useState(false);
  const slots = imageSlots(action);
  // however the drag ends, the slots fold away
  useEffect(() => {
    if (!imageOver) return;
    const done = () => setImageOver(false);
    window.addEventListener("dragend", done);
    window.addEventListener("drop", done);
    return () => {
      window.removeEventListener("dragend", done);
      window.removeEventListener("drop", done);
    };
  }, [imageOver]);

  const kind =
    action.phase === "DIVIDER"
      ? "divider"
      : action.phase === "TEXT"
        ? "note"
        : action.phase === "SETTING"
          ? "setting"
          : "phase";

  const select = (e: React.MouseEvent | React.KeyboardEvent) =>
    onToggleSelect(action.id, e.ctrlKey || e.metaKey, e.shiftKey);

  const cardProps = {
    role: "option",
    "aria-selected": isSelected,
    tabIndex: 0,
    onMouseDown: (e: React.MouseEvent) => {
      if (e.shiftKey) e.preventDefault(); // no text selection on shift-click
    },
    onClick: select,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(e);
      }
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (dragging(e, DRAG_IMAGE_KEY)) {
        // a picture: open this step's slots, if it has any
        if (slots.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (!imageOver) setImageOver(true);
        return;
      }
      onActionDragOver(e, action.id);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setImageOver(false);
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      if (dragging(e, DRAG_IMAGE_KEY)) {
        e.preventDefault();
        e.stopPropagation();
        setImageOver(false);
        // dropped on the card itself: fine when there's only one place it can go
        const ref = e.dataTransfer.getData(DRAG_IMAGE_KEY);
        if (ref && slots.length === 1) place(slots[0].key, ref);
        return;
      }
      onActionDrop(e, action.id);
    },
  } as const;

  function place(slot: string, ref: string) {
    setImageOver(false);
    if (action.question) updateQuestion(action.question.id, placeImage(action.question, slot, ref));
  }

  const handle = (
    <div
      className="jqzz-drag-handle"
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onActionDragStart(e, action.id);
      }}
      onDragEnd={onActionDragEnd}
      title="drag to move"
      aria-hidden="true"
    >
      ⠿
    </div>
  );

  const moveBtns = onMove && (
    <>
      <button
        className="jqzz-card-action-btn jqzz-touch-only"
        disabled={isFirst}
        onClick={(e) => {
          e.stopPropagation();
          onMove(action.id, -1);
        }}
        title="Move up"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        className="jqzz-card-action-btn jqzz-touch-only"
        disabled={isLast}
        onClick={(e) => {
          e.stopPropagation();
          onMove(action.id, 1);
        }}
        title="Move down"
        aria-label="Move down"
      >
        ↓
      </button>
    </>
  );

  const deleteBtn = (
    <button
      className="jqzz-card-action-btn del"
      onClick={(e) => {
        e.stopPropagation();
        deleteAction(action.id);
      }}
      title="Delete"
      aria-label={`Delete ${kind === "phase" ? action.phase.toLowerCase() : kind}`}
    >
      ✕
    </button>
  );

  const rowClass = `jqzz-row kind-${kind}${isOver ? " drag-over" : ""}${isDragging ? " dragging-self" : ""}${isSelected ? " is-selected" : ""}`;
  const flip = `a-${action.id}`;
  const phaseColor = { "--node": `var(--phase-${action.phase})` } as React.CSSProperties;

  if (kind === "divider") {
    return (
      <div className={rowClass} data-flip={flip} ref={rowRef}>
        <span className="jqzz-tc" />
        <span className="jqzz-node cross" aria-hidden="true" />
        <div
          className={`jqzz-divider-block${isSelected ? " selected" : ""}`}
          aria-label="Divider"
          {...cardProps}
        >
          {handle}
          <div className="jqzz-divider-line" />
          <span className="jqzz-divider-mark" aria-hidden="true">
            <Glyph name="DIVIDER" size={14} />
          </span>
          <span className="jqzz-annot">section</span>
          <div className="jqzz-divider-line" />
          <span className="jqzz-card-actions">
            {moveBtns}
            {deleteBtn}
          </span>
        </div>
      </div>
    );
  }

  if (kind === "setting") {
    const chips = describe(parseSettings(action.preview), true);
    return (
      <div className={rowClass} data-flip={flip} ref={rowRef}>
        <span className="jqzz-tc" />
        <span className="jqzz-node setting" aria-hidden="true" />
        <div
          className={`jqzz-setting-block${isSelected ? " selected" : ""}`}
          aria-label={`Settings from here on: ${chips.join(", ") || "none"}`}
          {...cardProps}
        >
          {handle}
          <span className="jqzz-setting-glyph" aria-hidden="true">
            <Glyph name="SETTING" size={14} />
          </span>
          <span className="jqzz-annot">from here</span>
          <span className="jqzz-setting-chips">
            {chips.length ? chips.map((c) => <span key={c}>{c}</span>) : <span>nothing set</span>}
          </span>
          <span className="jqzz-card-actions">
            {moveBtns}
            {deleteBtn}
          </span>
        </div>
      </div>
    );
  }

  if (kind === "note") {
    return (
      <div className={rowClass} data-flip={flip} ref={rowRef}>
        <span className="jqzz-tc jqzz-annot">{formatTimecode(start)}</span>
        <span className="jqzz-node note" aria-hidden="true" />
        <div
          className={`jqzz-text-block${isSelected ? " selected" : ""}`}
          aria-label={`Note: ${action.preview || "empty"}`}
          {...cardProps}
        >
          {handle}
          <span className="jqzz-note-glyph" aria-hidden="true">
            <Glyph name="TEXT" size={14} />
          </span>
          <span className="jqzz-text-block-content">{action.preview || "empty note"}</span>
          <span className="jqzz-annot jqzz-note-tag">for you only</span>
          <span className="jqzz-card-actions">
            {moveBtns}
            {deleteBtn}
          </span>
        </div>
      </div>
    );
  }

  const pct = maxTime > 0 ? Math.max(4, Math.round(((action.time || 0) / maxTime) * 100)) : 0;
  const q = action.question;

  return (
    <div className={rowClass} data-flip={flip} ref={rowRef}>
      <span className="jqzz-tc jqzz-annot">{formatTimecode(start)}</span>
      <span
        className={`jqzz-node${isSelected ? " selected" : ""}`}
        style={phaseColor}
        aria-hidden="true"
      >
        {isSelected && <span className="jqzz-star" />}
      </span>
      <div
        className={`jqzz-card phase-${action.phase}${isSelected ? " selected" : ""}${action.phase === "QUESTION" ? " tall" : ""}${imageOver ? " image-over" : ""}`}
        style={{ ...phaseColor, "--dur": `${pct}%` } as React.CSSProperties}
        aria-label={`${action.phase.toLowerCase()}, ${action.time} seconds, starts at ${formatTimecode(start)}${q?.text ? `: ${q.text}` : ""}`}
        {...cardProps}
      >
        {action.phase === "QUESTION" && <Backdrop src={q?.imageUrl} />}
        {handle}
        <span className="jqzz-card-glyph" aria-hidden="true">
          <Glyph name={action.phase} size={16} />
        </span>
        <span className="jqzz-card-main">
          <span className="jqzz-card-phase">{action.phase.toLowerCase()}</span>
          {action.phase === "QUESTION" && (
            <span className="jqzz-card-prompt">{q?.text || "no prompt yet"}</span>
          )}
          <PhasePreview action={action} />
        </span>
        <span className="jqzz-card-time">{action.time}s</span>
        <span className="jqzz-card-actions">
          {moveBtns}
          <button
            className="jqzz-card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              duplicateAction(action.id);
            }}
            title="Duplicate"
            aria-label={`Duplicate ${action.phase.toLowerCase()}`}
          >
            ⧉
          </button>
          {deleteBtn}
        </span>
        <span className="jqzz-card-bar" aria-hidden="true" />
        {imageOver && <ImageSlots slots={slots} onPlace={place} />}
      </div>
    </div>
  );
};
