import { useEffect } from "react";

/** ms a finger rests on something draggable before it's picked up */
const HOLD = 300;
/** px a finger may wander while resting; more and it was a scroll */
const SLOP = 8;

/**
 * Dragging, by finger. Most phone browsers never start a real drag from a
 * long press, so nothing that listens for drags (the timeline's gaps, a
 * step's picture slots, the editor's edge scrolling) ever hears of one.
 *
 * This fills in: hold anything draggable for a moment and it's picked up,
 * a copy follows the finger, and the same drag events a mouse would make
 * are sent to whatever is under it (dragstart on the thing itself, then
 * dragenter, dragover and dragleave as the finger moves, drop and dragend
 * when it lifts), carrying one DataTransfer the whole way. Every drop
 * target already written for the mouse works for the finger as it is.
 *
 * If the browser does start a real drag of its own, this steps aside.
 */
export function useTouchDrag() {
  useEffect(() => {
    if (typeof DataTransfer === "undefined") return;

    let source: HTMLElement | null = null;
    let hold = 0;
    let start = { x: 0, y: 0 };
    let point = { x: 0, y: 0 };
    let dt: DataTransfer | null = null;
    let ghost: HTMLElement | null = null;
    let offset = { x: 0, y: 0 };
    let over: Element | null = null;
    let accepted = false;
    let pulse = 0;

    const fire = (target: EventTarget, type: string, related: Element | null = null) => {
      const e = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        dataTransfer: dt,
        relatedTarget: related,
      });
      target.dispatchEvent(e);
      return e;
    };

    const moveGhost = () => {
      if (ghost) ghost.style.transform = `translate3d(${point.x - offset.x}px, ${point.y - offset.y}px, 0)`;
    };

    // what's under the finger now: tell it, and the one it left
    const track = () => {
      if (!dt) return;
      const el = document.elementFromPoint(point.x, point.y);
      if (el !== over) {
        if (over) fire(over, "dragleave", el);
        if (el) fire(el, "dragenter", over);
        over = el;
      }
      accepted = el ? fire(el, "dragover").defaultPrevented : false;
    };

    const reset = () => {
      window.clearTimeout(hold);
      window.clearInterval(pulse);
      ghost?.remove();
      ghost = null;
      source?.classList.remove("jqzz-touch-dragging");
      source = null;
      dt = null;
      over = null;
      accepted = false;
    };

    const pickUp = () => {
      if (!source) return;
      dt = new DataTransfer();
      fire(source, "dragstart");
      if (dt.types.length === 0) {
        // nothing said what it carries: not a drag after all
        reset();
        return;
      }
      const box = source.getBoundingClientRect();
      offset = { x: Math.min(point.x - box.left, box.width), y: Math.min(point.y - box.top, box.height) };
      ghost = source.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("id");
      ghost.classList.add("jqzz-touch-ghost");
      ghost.style.width = `${box.width}px`;
      ghost.style.height = `${box.height}px`;
      document.body.appendChild(ghost);
      moveGhost();
      source.classList.add("jqzz-touch-dragging");
      navigator.vibrate?.(10);
      track();
      // keep telling the target where the finger is even while it rests,
      // the way a real drag does, so edge scrolling and gaps keep up
      pulse = window.setInterval(track, 120);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || dt) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[draggable='true']");
      if (!el) return;
      source = el;
      const t = e.touches[0];
      start = point = { x: t.clientX, y: t.clientY };
      hold = window.setTimeout(pickUp, HOLD);
    };

    const onMove = (e: TouchEvent) => {
      if (!source) return;
      const t = e.touches[0];
      point = { x: t.clientX, y: t.clientY };
      if (!dt) {
        // moved before the hold was up: a scroll, not a pick-up
        if (Math.hypot(point.x - start.x, point.y - start.y) > SLOP) reset();
        return;
      }
      e.preventDefault(); // the page stays put while something is carried
      moveGhost();
      track();
    };

    const onEnd = (e: TouchEvent) => {
      if (!source) return;
      if (!dt) {
        reset();
        return;
      }
      e.preventDefault(); // no click on whatever it was dropped over
      const from = source;
      if (over && accepted) fire(over, "drop");
      else if (over) fire(over, "dragleave");
      fire(from, "dragend");
      reset();
    };

    const onCancel = () => {
      if (dt && source) fire(source, "dragend");
      reset();
    };

    // the browser started a real drag of its own: before ours, let it have
    // it; after ours picked the thing up, ours carries on and theirs doesn't
    const onNativeDrag = (e: DragEvent) => {
      if (!e.isTrusted || !source) return;
      if (dt) e.preventDefault();
      else reset();
    };

    // a long press would otherwise bring up the system's menu on the item
    const onMenu = (e: Event) => {
      if (source) e.preventDefault();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: false });
    document.addEventListener("touchcancel", onCancel);
    document.addEventListener("dragstart", onNativeDrag);
    document.addEventListener("contextmenu", onMenu);
    return () => {
      reset();
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      document.removeEventListener("dragstart", onNativeDrag);
      document.removeEventListener("contextmenu", onMenu);
    };
  }, []);
}
