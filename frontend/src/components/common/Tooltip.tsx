import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Our tooltip, for every `title` in the app. Rather than rewrite each one,
 * this takes them over: the first time you point at (or tab to) something
 * with a title, its text moves to data-tip, so the browser's grey box never
 * shows, and this bubble shows it instead. If the title was the element's
 * only name (an icon button), it becomes its aria-label so nothing is lost
 * for screen readers.
 */
export const Tooltip: React.FC = () => {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<Element | null>(null);
  const bubble = useRef<HTMLDivElement>(null);

  // once it's drawn, keep the whole bubble on screen; the arrow still points at the element
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!tip || !el) return;
    const half = el.offsetWidth / 2;
    const x = Math.max(12 + half, Math.min(window.innerWidth - 12 - half, tip.x));
    el.style.left = `${x}px`;
    el.style.setProperty("--arrow", `${tip.x - x}px`);
  }, [tip]);

  useEffect(() => {
    const adopt = (el: Element) => {
      const title = el.getAttribute("title");
      if (title === null) return;
      el.removeAttribute("title");
      if (!title.trim()) return;
      el.setAttribute("data-tip", title);
      const named = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
      if (!named && !(el.textContent ?? "").trim()) el.setAttribute("aria-label", title);
    };

    const show = (el: Element) => {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 56;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 10 : r.top - 10, below });
    };

    const target = (from: EventTarget | null) => {
      const node = from instanceof Element ? from : null;
      const el = node?.closest("[title], [data-tip]") ?? null;
      if (el?.hasAttribute("title")) adopt(el);
      return el?.hasAttribute("data-tip") ? el : null;
    };

    const enter = (e: Event, delay: number) => {
      const el = target(e.target);
      if (el === current.current) return;
      current.current = el;
      window.clearTimeout(timer.current);
      setTip(null);
      if (el) timer.current = window.setTimeout(() => show(el), delay);
    };
    const leave = () => {
      current.current = null;
      window.clearTimeout(timer.current);
      setTip(null);
    };

    const over = (e: PointerEvent) => enter(e, 380);
    const focus = (e: FocusEvent) => {
      // keyboard focus only: a click focuses too, and shouldn't pop a bubble
      if ((e.target as Element)?.matches?.(":focus-visible")) enter(e, 120);
    };
    window.addEventListener("pointerover", over);
    window.addEventListener("focusin", focus);
    window.addEventListener("focusout", leave);
    window.addEventListener("pointerdown", leave);
    window.addEventListener("scroll", leave, true);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && leave();
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerover", over);
      window.removeEventListener("focusin", focus);
      window.removeEventListener("focusout", leave);
      window.removeEventListener("pointerdown", leave);
      window.removeEventListener("scroll", leave, true);
      window.removeEventListener("keydown", esc);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      ref={bubble}
      className={`jqzz-tooltip${tip.below ? " below" : ""}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>,
    document.body,
  );
};
