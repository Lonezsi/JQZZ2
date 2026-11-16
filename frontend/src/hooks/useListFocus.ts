import { useEffect, useRef } from "react";

/*
 * A list of text fields that edit like one (the roster, a question's answers):
 * Enter makes the next one, Backspace in an empty one removes it, arrows move
 * between them. What's shared is the caret: after a row is added or taken out,
 * it has to land in the right field, once the render that makes that field is
 * done, and before the next key can land somewhere else. Callers commit their
 * change with flushSync and then call focusAt.
 */
export function useListFocus() {
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const pending = useRef<number | null>(null);

  const apply = () => {
    const i = pending.current;
    const f = i === null ? null : fields.current[i];
    if (!f) return;
    pending.current = null;
    f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
  };
  // a render that came later than the call (one started outside React) still gets its caret
  useEffect(apply);

  return {
    /** the ref for field i */
    ref: (i: number) => (el: HTMLInputElement | null) => {
      fields.current[i] = el;
    },
    /** the caret into field i, at its end: now if it's drawn, else after the next render */
    focusAt: (i: number) => {
      pending.current = i;
      apply();
    },
  };
}

/** a pasted list, one item a line: null when it's a single line (let the field take it) */
export function pastedLines(e: React.ClipboardEvent): string[] | null {
  const text = e.clipboardData.getData("text");
  if (!/[\r\n]/.test(text)) return null;
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
