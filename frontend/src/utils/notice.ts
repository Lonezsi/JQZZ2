import { useSyncExternalStore } from "react";

/*
 * One notice at a time, at the foot of the editor (components/common/NoticeBar.tsx),
 * in place of the browser's alert and confirm boxes. It says what happened,
 * and may carry one thing to do about it: "undo" after a delete (also Z),
 * "open the stash" after stashing. A newer notice replaces the one showing.
 *
 * Only deletes are undoable: everything else in the editor is a change you
 * can see and change back.
 */

export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface Notice {
  text: string;
  action?: NoticeAction;
  /** an error stays a little longer and is read out at once */
  error?: boolean;
  /** this one's action is an undo, so Z runs it */
  undo?: boolean;
  /** a fresh number per notice, so the bar restarts its clock */
  n: number;
}

const SHOWN_MS = 6000;
const ERROR_MS = 9000;
let current: Notice | null = null;
let timer: number | undefined;
let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function show(n: Omit<Notice, "n">) {
  current = { ...n, n: ++count };
  window.clearTimeout(timer);
  timer = window.setTimeout(dismissNotice, n.error ? ERROR_MS : SHOWN_MS);
  emit();
}

/** says something at the foot of the editor, with one optional thing to do */
export function notify(text: string, action?: NoticeAction) {
  show({ text, action });
}

/** something went wrong: said plainly, and kept up a little longer */
export function notifyError(text: string) {
  show({ text, error: true });
}

/** after a delete: "deleted 3 steps · undo" */
export function offerUndo(text: string, restore: () => void) {
  show({ text, action: { label: "undo", run: restore }, undo: true });
}

export function dismissNotice() {
  if (!current) return;
  current = null;
  window.clearTimeout(timer);
  emit();
}

/** puts the last delete back; false when the notice showing isn't an undo */
export function undoNow(): boolean {
  const showing = current;
  if (!showing?.undo || !showing.action) return false;
  dismissNotice();
  showing.action.run();
  return true;
}

export function useNotice(): Notice | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** the steps that were taken out go back where they were, around whatever changed since */
export function putBack<T extends { id: number }>(now: T[], before: T[], gone: Set<number>): T[] {
  const out = now.filter((a) => !gone.has(a.id));
  before.forEach((a, i) => {
    if (gone.has(a.id)) out.splice(Math.min(i, out.length), 0, a);
  });
  return out;
}
