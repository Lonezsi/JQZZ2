import { useState } from "react";
import type { DragEvent } from "react";

const DRAG_SNIPPET_KEY = "jqzz-snippet";
const DRAG_ACTION_KEY = "jqzz-action";

export const useDragAndDrop = (
  dropSnippet: (snippetId: string) => void,
  reorderActions: (dragId: number, dropId: number) => void,
) => {
  const [draggingSnippet, setDraggingSnippet] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [dragActionId, setDragActionId] = useState<number | null>(null);
  const [dragOverActionId, setDragOverActionId] = useState<number | null>(null);

  const onSnippetDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData(DRAG_SNIPPET_KEY, id);
    setDraggingSnippet(id);
  };
  const onSnippetDragEnd = () => {
    setDraggingSnippet(null);
    setDropOver(false);
  };
  const onDropZoneDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDropOver(true);
  };
  const onDropZoneDragLeave = () => setDropOver(false);
  const onDropZoneDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const sid = e.dataTransfer.getData(DRAG_SNIPPET_KEY);
    if (sid) dropSnippet(sid);
    setDropOver(false);
  };

  const onActionDragStart = (e: DragEvent<HTMLDivElement>, id: number) => {
    e.dataTransfer.setData(DRAG_ACTION_KEY, String(id));
    e.dataTransfer.effectAllowed = "move";
    setDragActionId(id);
  };
  const onActionDragEnd = () => {
    setDragActionId(null);
    setDragOverActionId(null);
  };
  const onActionDragOver = (e: DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes(DRAG_ACTION_KEY)) setDragOverActionId(id);
  };
  const onActionDrop = (e: DragEvent<HTMLDivElement>, dropId: number) => {
    e.preventDefault();
    const dragId = Number(e.dataTransfer.getData(DRAG_ACTION_KEY));
    if (dragId && dragId !== dropId) reorderActions(dragId, dropId);
    setDragActionId(null);
    setDragOverActionId(null);
  };

  return {
    draggingSnippet,
    dropOver,
    dragActionId,
    dragOverActionId,
    onSnippetDragStart,
    onSnippetDragEnd,
    onDropZoneDragOver,
    onDropZoneDragLeave,
    onDropZoneDrop,
    onActionDragStart,
    onActionDragEnd,
    onActionDragOver,
    onActionDrop,
  };
};
