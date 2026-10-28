import React, { useEffect, useRef, useState } from "react";
import type { Action, Quiz, RenderItem } from "../../../../types";
import { ActionCard } from "./ActionCard";
import { EmptyState } from "./EmptyState";
import { AddButton } from "./AddButton";
import { Welcome } from "../../Welcome/Welcome";
import { actionStartTimes } from "../../../../utils/timecode";
import { useFlip } from "../../../../hooks/useFlip";
import { useQuiz } from "../../../../contexts/QuizContext";
import { Glyph } from "../../../common/Glyph";
import { maxPoints, typeLabel } from "../../../../utils/questionInfo";
import { changed, describe, settingsAt } from "../../../../utils/settings";
import { AddTypeButton } from "./AddTypeButton";
import { DropSkeleton } from "./DropSkeleton";
import { DRAG_GROUP_KEY, DRAG_SNIPPET_KEY, dragging } from "../../../../utils/dragKeys";
import { snippetActions } from "../../../../utils/snippetActions";
import { readContent } from "../../../../utils/stashContent";

interface VisualModeProps {
  quiz: Quiz | undefined;
  renderItems: RenderItem[];
  selectedActionIds: Set<number>;
  toggleSelectAction: (
    id: number,
    ctrlKey?: boolean,
    shiftKey?: boolean,
  ) => void;
  dragActionId: number | null;
  dragOverActionId: number | null;
  onActionDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDragEnd: () => void;
  onActionDragOver: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
  onActionDrop: (e: React.DragEvent<HTMLDivElement>, dropId: number) => void;
  deleteAction: (id: number) => void;
  duplicateAction: (id: number) => void;
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
  onNewQuiz: () => void;
  onImport: () => void;
}

export const VisualMode: React.FC<VisualModeProps> = ({
  quiz,
  renderItems,
  selectedActionIds,
  toggleSelectAction,
  dragActionId,
  dragOverActionId,
  onActionDragStart,
  onActionDragEnd,
  onActionDragOver,
  onActionDrop,
  deleteAction,
  duplicateAction,
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onNewQuiz,
  onImport,
}) => {
  const { dropSnippet, setMode, reorderActions, moveActions } = useQuiz();
  // the order of the rows, which is all the FLIP animation needs to watch
  const flipSignature = `${quiz?.id}:${renderItems
    .map((item) =>
      item.kind === "group"
        ? `g${item.question.id}(${item.actions.map((a) => a.id).join(".")})`
        : item.action.id,
    )
    .join("|")}`;
  const timelineRef = useFlip<HTMLDivElement>(flipSignature);

  // Something being dragged in from the tray or the stash: what it will become
  // (read once, when the drag starts, since a drag hides its data until the
  // drop) and the gap between the timeline's items where it would land.
  // A whole question being moved works the same way, carrying its step ids.
  const [incoming, setIncoming] = useState<{ actions: Action[]; name?: string; moving?: Set<number> } | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const slotRef = useRef<number | null>(null);
  const quizRef = useRef(quiz);
  useEffect(() => {
    quizRef.current = quiz;
  });
  useEffect(() => {
    const start = (e: DragEvent) => {
      const group = e.dataTransfer?.getData(DRAG_GROUP_KEY);
      if (group) {
        const ids = new Set<number>(JSON.parse(group));
        const actions = quizRef.current?.actions.filter((a) => ids.has(a.id)) ?? [];
        setIncoming(actions.length ? { actions, moving: ids } : null);
        return;
      }
      const id = e.dataTransfer?.getData(DRAG_SNIPPET_KEY);
      if (!id) return;
      const actions = snippetActions(id);
      const name = id.startsWith("stash:") ? readContent({ payload: id.slice(6) }).name : undefined;
      setIncoming(actions.length ? { actions, name } : null);
    };
    const end = () => {
      setIncoming(null);
      setSlot(null);
      slotRef.current = null;
    };
    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, []);

  /** which gap the pointer is nearest: 0 is before the first item, items.length after the last */
  const gapAt = (clientY: number) => {
    const rows = [...(timelineRef.current?.children ?? [])].filter(
      (el) => !el.classList.contains("jqzz-drop-skeleton") && !el.classList.contains("kind-add"),
    );
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return rows.length;
  };

  if (!quiz) {
    return <Welcome onCreate={onNewQuiz} onImport={onImport} />;
  }

  if (renderItems.length === 0) {
    return (
      <EmptyState
        dropOver={dropOver}
        onDropZoneDragOver={onDropZoneDragOver}
        onDropZoneDragLeave={onDropZoneDragLeave}
        onDropZoneDrop={onDropZoneDrop}
        onPick={dropSnippet}
        onTextMode={() => setMode("text")}
      />
    );
  }

  const starts = actionStartTimes(quiz.actions);
  const settings = settingsAt(quiz.actions);

  // Number questions by first appearance, like text mode's Q1, Q2, ...
  const questionNumbers = new Map<number, number>();
  for (const item of renderItems) {
    if (item.kind === "group" && !questionNumbers.has(item.question.id)) {
      questionNumbers.set(item.question.id, questionNumbers.size + 1);
    }
  }

  const maxTime = Math.max(1, ...quiz.actions.map((a) => a.time || 0));

  // one step up or down: the touch stand-in for dragging, which phones do not do
  const order = quiz.actions;
  const move = (id: number, dir: -1 | 1) => {
    const i = order.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    reorderActions(id, order[j].id);
  };

  /** the gaps just before and after the question being moved change nothing */
  const movingAt = incoming?.moving
    ? renderItems.findIndex((it) => it.kind === "group" && incoming.moving!.has(it.actions[0].id))
    : -1;
  const besideItself = (gap: number) => movingAt >= 0 && (gap === movingAt || gap === movingAt + 1);

  /** one question up or down past its neighbour: the touch stand-in for dragging it */
  const moveGroup = (idx: number, dir: -1 | 1) => {
    const item = renderItems[idx];
    if (item?.kind !== "group") return;
    const ids = item.actions.map((a) => a.id);
    if (dir === -1) {
      const before = firstAction(renderItems[idx - 1]);
      if (before) moveActions(ids, before.id);
    } else if (renderItems[idx + 1]) {
      moveActions(ids, firstAction(renderItems[idx + 2])?.id ?? null);
    }
  };

  const card = (a: Action) => (
    <ActionCard
      key={a.id}
      action={a}
      start={starts.get(a.id) ?? 0}
      maxTime={maxTime}
      isSelected={selectedActionIds.has(a.id)}
      isDragging={a.id === dragActionId}
      isOver={a.id === dragOverActionId && dragActionId !== a.id}
      onToggleSelect={toggleSelectAction}
      onActionDragStart={onActionDragStart}
      onActionDragEnd={onActionDragEnd}
      onActionDragOver={onActionDragOver}
      onActionDrop={onActionDrop}
      deleteAction={deleteAction}
      duplicateAction={duplicateAction}
      onMove={move}
      isFirst={order[0]?.id === a.id}
      isLast={order[order.length - 1]?.id === a.id}
    />
  );

  return (
    <div
      ref={timelineRef}
      className={`jqzz-timeline${incoming && slot != null ? " taking" : ""}`}
      role="listbox"
      aria-multiselectable="true"
      aria-label="Quiz timeline"
      onDragOver={(e) => {
        if (!incoming || !(dragging(e, DRAG_SNIPPET_KEY) || dragging(e, DRAG_GROUP_KEY))) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = incoming.moving ? "move" : "copy";
        const at = gapAt(e.clientY);
        if (at !== slotRef.current) {
          slotRef.current = at;
          setSlot(at);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        slotRef.current = null;
        setSlot(null);
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DRAG_SNIPPET_KEY);
        const group = e.dataTransfer.getData(DRAG_GROUP_KEY);
        if (!id && !group) return;
        e.preventDefault();
        e.stopPropagation();
        // between two items: in front of the first step of the one after the gap
        const at = slotRef.current ?? renderItems.length;
        const first = firstAction(renderItems[at]);
        if (group) {
          moveActions(JSON.parse(group), first?.id ?? null);
        } else {
          const index = first ? quiz.actions.findIndex((a) => a.id === first.id) : quiz.actions.length;
          dropSnippet(id, index < 0 ? undefined : index);
        }
        setIncoming(null);
        setSlot(null);
        slotRef.current = null;
      }}
    >
      {renderItems.map((item, idx) => {
        const skeleton =
          incoming && slot === idx && !besideItself(idx) ? (
            <DropSkeleton key="incoming" actions={incoming.actions} name={incoming.name} />
          ) : null;
        if (item.kind !== "group") {
          return skeleton ? [skeleton, card(item.action)] : card(item.action);
        }

        const q = item.question;
        const n = questionNumbers.get(q.id);
        const seconds = item.actions.reduce((sum, a) => sum + (a.time || 0), 0);
        const answers = q.answers?.length ?? 0;
        const max = maxPoints(q);
        const inForce = settings.get(item.actions[0]?.id);
        const chips = inForce ? describe(changed(inForce)) : [];
        const weight = inForce ? (inForce.grade ? inForce.points : 0) : 1;
        return [
          skeleton,
          <div
            key={`${q.id}-${idx}`}
            className={`jqzz-group${movingAt === idx ? " moving" : ""}`}
            role="group"
            aria-label={`Question ${n}: ${q.text}`}
          >
            <div
              className="jqzz-group-head"
              data-flip={`g-${q.id}-${item.actions[0]?.id}`}
              draggable
              title="drag to move the whole question"
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_GROUP_KEY, JSON.stringify(item.actions.map((a) => a.id)));
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <span className="jqzz-group-num">
                <span className="q OEF">Q</span>
                {n}
              </span>
              <span className="jqzz-node ring" aria-hidden="true" />
              <div className="jqzz-plate">
                <div className="jqzz-plate-top">
                  <span className="jqzz-type-pill">
                    <Glyph name={q.type || "PREWRITTEN_SINGLE"} size={12} />
                    {typeLabel(q.type)}
                  </span>
                  {q.imageUrl && (
                    <span className="jqzz-type-pill ghost" title={q.imageUrl}>
                      has image
                    </span>
                  )}
                  {chips.map((c) => (
                    <span key={c} className="jqzz-type-pill setting" title="from a settings block above">
                      {c}
                    </span>
                  ))}
                  <AddTypeButton question={q} actions={item.actions} />
                  <span className="jqzz-group-move">
                    <span className="jqzz-group-grip" aria-hidden="true">
                      ⠿
                    </span>
                    <button
                      className="jqzz-card-action-btn jqzz-touch-only"
                      disabled={idx === 0}
                      onClick={() => moveGroup(idx, -1)}
                      aria-label={`Move question ${n} up`}
                      title="move the question up"
                    >
                      ↑
                    </button>
                    <button
                      className="jqzz-card-action-btn jqzz-touch-only"
                      disabled={idx === renderItems.length - 1}
                      onClick={() => moveGroup(idx, 1)}
                      aria-label={`Move question ${n} down`}
                      title="move the question down"
                    >
                      ↓
                    </button>
                  </span>
                </div>
                <span className="jqzz-group-text">{q.text || "untitled question"}</span>
                {/* the question's rhythm: its phases, widths by time */}
                <span className="jqzz-phase-strip" aria-hidden="true">
                  {item.actions.map((a) => (
                    <span
                      key={a.id}
                      style={{ flexGrow: Math.max(a.time, 1), background: `var(--phase-${a.phase})` }}
                    />
                  ))}
                </span>
                <span className="jqzz-annot">
                  {item.actions.length} {item.actions.length === 1 ? "phase" : "phases"} ·{" "}
                  {seconds}s · {answers} {answers === 1 ? "answer" : "answers"}
                  {max !== null && ` · up to ${Math.round(max * weight)} pts`}
                </span>
              </div>
            </div>
            {item.actions.map(card)}
          </div>,
        ];
      })}
      {incoming && slot === renderItems.length && !besideItself(renderItems.length) && (
        <DropSkeleton actions={incoming.actions} name={incoming.name} />
      )}
      <div className="jqzz-row kind-add" data-flip="add">
        <span className="jqzz-tc" />
        <span className="jqzz-node end" aria-hidden="true" />
        <AddButton
          dropOver={dropOver}
          onDropZoneDragOver={onDropZoneDragOver}
          onDropZoneDragLeave={onDropZoneDragLeave}
          onDropZoneDrop={onDropZoneDrop}
          onPick={dropSnippet}
        />
      </div>
    </div>
  );
};

/** an item's first step: where something put in front of it goes */
function firstAction(item: RenderItem | undefined): Action | null {
  if (!item) return null;
  return item.kind === "group" ? item.actions[0] : item.action;
}
