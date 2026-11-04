import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { BRUSHES, brushOf, type ToolId } from "./brushes";
import { Painter, type Sample } from "./painter";
import { PAPERS } from "./paper";
import { ActionIcon, ToolIcon } from "./icons";
import { LayersPanel } from "./LayersPanel";
import { HOME, isHome, keepInReach, snapAngle, toSheet, twoFingers, viewLabel, zoomAt, type Pt, type View } from "./view";
import { useFitHeight } from "./fit";
import { ColorPicker } from "./ColorPicker";

/*
 * The drawing frame: a sheet of paper and a box of tools. Everything here
 * is the controls; the marks themselves are made by the Painter.
 *
 * On a phone it's laid out like a drawing app: a bar of actions on top, the
 * sheet in a window under it, the brushes and their settings docked below
 * (or down the side, held sideways). One finger or a pen draws; two fingers
 * move, turn and zoom the sheet in the window.
 */

/** the popovers: one open at a time */
type Pop = "colors" | "picker" | "paper" | "layers" | null;

/** the sheet, in its own pixels; it's scaled to fit the screen */
export const SHEET_W = 1200;
export const SHEET_H = 900;

const PALETTE = [
  "#1d1a24", "#55525e", "#9a958d", "#ffffff",
  "#c9302c", "#ef6a3a", "#f4a338", "#f5d33f",
  "#9bc53d", "#2e9a58", "#1d9a96", "#47a7e6",
  "#2c5bcf", "#4a37a6", "#8b4cc6", "#ea6aa6",
  "#7a4a2a", "#b9774b", "#e5b38c", "#f6dcc4",
];

/** what each tool was last set to, so switching back finds it as it was */
type ToolSettings = Partial<Record<ToolId, { size: number; opacity: number }>>;

const KEEP = "jqzz:draw";
interface Kept {
  tool: ToolId;
  color: string;
  paper: string;
  tools: ToolSettings;
  recent: string[];
}

function readKept(): Kept {
  const fallback: Kept = { tool: "pencil", color: PALETTE[0], paper: "white", tools: {}, recent: [] };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(KEEP) ?? "{}") };
  } catch {
    return fallback;
  }
}

function writeKept(k: Kept) {
  try {
    localStorage.setItem(KEEP, JSON.stringify(k));
  } catch {
    /* private mode: settings just aren't kept */
  }
}

export interface DrawingFrameHandle {
  /** the picture as a file */
  export(): Promise<Blob>;
  /** every layer, as the painter keeps them: to save it as a drawing (the stash) */
  snapshot(): string;
  /** to download: the picture, or every layer of it (OpenRaster) */
  png(): Promise<Blob>;
  ora(): Promise<Blob>;
  /** whether anything changed since it was last sent */
  readonly unsent: boolean;
  readonly empty: boolean;
}

interface Props {
  /** keeps the drawing in progress under this key, so a reload doesn't lose it */
  keepAs?: string;
  /** a picture to start from (one already sent) */
  start?: string | null;
  /** sends the picture; resolves true when it was taken */
  onSend?: (picture: Blob) => Promise<boolean>;
  sendLabel?: string;
  /** what sending is called on the button and the line under it: a game sends, the stash saves */
  verb?: "send" | "save";
  /** server time it's due: whatever is drawn goes by itself just before */
  dueAt?: number | null;
  serverNow?: () => number;
}

export const DrawingFrame = forwardRef<DrawingFrameHandle, Props>(function DrawingFrame(
  { keepAs, start, onSend, sendLabel = "send", verb = "send", dueAt, serverNow },
  ref,
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const painter = useRef<Painter | null>(null);
  const kept = useRef<Kept>(readKept());

  const [tool, setTool] = useState<ToolId>(kept.current.tool);
  const [color, setColor] = useState(kept.current.color);
  const [paper, setPaper] = useState(kept.current.paper);
  const [tools, setTools] = useState<ToolSettings>(kept.current.tools);
  const [recent, setRecent] = useState<string[]>(kept.current.recent);
  const [mirror, setMirror] = useState(false);
  // the view turned over left to right, to see the drawing with fresh eyes;
  // the drawing itself doesn't change
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);
  const [pop, setPop] = useState<Pop>(null);
  const toggle = (which: Exclude<Pop, null>) => setPop((open) => (open === which ? null : which));
  const [, setTick] = useState(0);
  const [sentAt, setSentAt] = useState(-1);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const brush = brushOf(tool);
  const size = tools[tool]?.size ?? brush.size.start;
  const opacity = tools[tool]?.opacity ?? brush.opacity;

  // ─── the painter ───────────────────────────────────────────────

  useEffect(() => {
    const p = new Painter(canvasRef.current!, { width: SHEET_W, height: SHEET_H, paper: kept.current.paper });
    painter.current = p;
    p.onChange = () => setTick((t) => t + 1);
    p.onPick = (hex) => {
      setColor(hex);
      setTool((t) => (t === "pick" ? lastBrush.current : t));
    };
    let saved: string | null = null;
    try {
      saved = keepAs ? sessionStorage.getItem(keepAs) : null;
    } catch {
      saved = null;
    }
    const from = saved ?? start;
    // a drawing of our own says which paper it's on; one that was already
    // sent (not work kept from a reload) starts out with nothing new to send
    if (from)
      p.load(from)
        .then(() => {
          setPaper(p.paper);
          if (!saved) setSentAt(p.revision);
        })
        .catch(() => {});
    return () => p.destroy();
    // the sheet is made once; what it starts from is read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastBrush = useRef<ToolId>("pencil");
  useEffect(() => {
    if (brushOf(tool).kind !== "tool") lastBrush.current = tool;
  }, [tool]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    p.tool = tool;
    p.color = color;
    p.size = size;
    p.opacity = opacity;
    p.symmetry = mirror;
    p.setPaper(paper);
  }, [tool, color, size, opacity, mirror, paper]);

  useEffect(() => {
    kept.current = { tool: lastBrush.current, color, paper, tools, recent };
    writeKept(kept.current);
  }, [tool, color, paper, tools, recent]);

  // keep the drawing in progress, a little after each change
  const revision = painter.current?.revision ?? 0;
  useEffect(() => {
    if (!keepAs || !painter.current || revision === 0) return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(keepAs, painter.current!.snapshot());
      } catch {
        /* too big or not allowed: it's only a safety net */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [keepAs, revision]);

  // ─── sending ───────────────────────────────────────────────────

  const send = useCallback(async () => {
    const p = painter.current;
    if (!p || !onSend || sending) return false;
    setSending(true);
    setProblem(null);
    try {
      const at = p.revision;
      const ok = await onSend(await p.export());
      if (ok) setSentAt(at);
      return ok;
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send it");
      return false;
    } finally {
      setSending(false);
    }
  }, [onSend, sending]);

  const unsent = !!painter.current && !painter.current.isEmpty && painter.current.revision !== sentAt;

  useImperativeHandle(
    ref,
    () => ({
      export: () => painter.current!.export(),
      snapshot: () => painter.current!.snapshot(),
      png: () => painter.current!.png(),
      ora: () => painter.current!.ora(),
      get unsent() {
        return !!painter.current && !painter.current.isEmpty && painter.current.revision !== sentAt;
      },
      get empty() {
        return painter.current?.isEmpty ?? true;
      },
    }),
    [sentAt],
  );

  // time's nearly up: send what's there, finished or not
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!dueAt || !serverNow || !onSend) return;
    const wait = dueAt - serverNow() - 1600;
    const t = window.setTimeout(() => {
      const p = painter.current;
      if (p && !p.isEmpty && p.revision !== sentAtRef.current) {
        if (p.drawing) p.end();
        sendRef.current();
      }
    }, Math.max(0, wait));
    return () => window.clearTimeout(t);
  }, [dueAt, serverNow, onSend]);
  const sentAtRef = useRef(sentAt);
  sentAtRef.current = sentAt;

  // ─── the pen ───────────────────────────────────────────────────

  // ─── the view: where the sheet sits in its window ─────────────

  /** the sheet's size when it just fits the window, and the window's */
  const fitted = useRef({ fit: 1, w: 0, h: 0, vw: 0, vh: 0 });
  const view = useRef<View>(HOME);

  const apply = useCallback((next: View, settle = false) => {
    const f = fitted.current;
    const v = keepInReach(next, f.w, f.h, f.vw, f.vh);
    view.current = v;
    const s = sheetRef.current;
    if (s) {
      s.classList.toggle("settle", settle);
      s.style.transform = `translate(${v.x}px, ${v.y}px) rotate(${v.angle}rad) scale(${v.scale})${flippedRef.current ? " scaleX(-1)" : ""}`;
    }
    const z = zoomRef.current;
    if (z) {
      z.textContent = viewLabel(v);
      z.classList.toggle("home", isHome(v));
    }
  }, []);

  /** after a gesture: nearly straight goes straight, nearly 100% goes 100% */
  const settle = useCallback(() => {
    const v = view.current;
    const angle = snapAngle(v.angle);
    const scale = angle === 0 && Math.abs(v.scale - 1) < 0.04 ? 1 : v.scale;
    if (angle !== v.angle || scale !== v.scale) apply({ ...v, angle, scale }, true);
  }, [apply]);

  const resetView = useCallback(() => apply(HOME, true), [apply]);

  // the sheet fits the window, and keeps fitting it as the window changes
  useLayoutEffect(() => {
    const win = windowRef.current!;
    const sheet = sheetRef.current!;
    const measure = () => {
      const vw = win.clientWidth;
      const vh = win.clientHeight;
      const pad = vw < 520 ? 8 : 16;
      const fit = Math.max(0.01, Math.min((vw - pad * 2) / SHEET_W, (vh - pad * 2) / SHEET_H));
      const w = SHEET_W * fit;
      const h = SHEET_H * fit;
      fitted.current = { fit, w, h, vw, vh };
      sheet.style.width = `${w}px`;
      sheet.style.height = `${h}px`;
      sheet.style.marginLeft = `${-w / 2}px`;
      sheet.style.marginTop = `${-h / 2}px`;
      apply(view.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(win);
    return () => ro.disconnect();
  }, [apply]);

  // a wheel with ctrl (or a trackpad pinch) zooms; zoomed in, the wheel moves the sheet.
  // and the page under the sheet never scrolls, bounces or zooms itself
  useEffect(() => {
    const win = windowRef.current!;
    const onWheel = (e: WheelEvent) => {
      const r = win.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const v = view.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const at = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
        const step = Math.max(-0.25, Math.min(0.25, -e.deltaY * unit * 0.01));
        apply(zoomAt(v, at, Math.exp(step)));
      } else if (v.scale > 1.01) {
        e.preventDefault();
        apply({ ...v, x: v.x - e.deltaX * unit, y: v.y - e.deltaY * unit });
      }
    };
    const stop = (e: Event) => e.preventDefault();
    win.addEventListener("wheel", onWheel, { passive: false });
    win.addEventListener("touchmove", stop, { passive: false });
    win.addEventListener("gesturestart", stop);
    return () => {
      win.removeEventListener("wheel", onWheel);
      win.removeEventListener("touchmove", stop);
      win.removeEventListener("gesturestart", stop);
    };
  }, [apply]);

  // ─── the pen, and fingers ──────────────────────────────────────

  const box = useRef<DOMRect | null>(null);
  const active = useRef<number | null>(null);
  const penSeen = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>());
  const gesture = useRef<{ at: number; moved: boolean; most: number; ids: number[]; a0: Pt; b0: Pt; start: View } | null>(null);
  const pan = useRef<{ id: number; x: number; y: number; start: View } | null>(null);
  /** a tap that only closed a popover: it doesn't draw too */
  const swallow = useRef<number | null>(null);

  /** a point on the screen, from the middle of the window */
  const local = (x: number, y: number): Pt => {
    const r = box.current!;
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  };

  const sample = (e: PointerEvent | React.PointerEvent, r: DOMRect): Sample => {
    const pen = e.pointerType === "pen";
    const v = view.current;
    // altitude: how far the pen leans away from upright
    const tx = (e.tiltX ?? 0) * (Math.PI / 180);
    const ty = (e.tiltY ?? 0) * (Math.PI / 180);
    const lean = Math.min(1, Math.hypot(Math.tan(tx), Math.tan(ty)) / 2.2);
    const at = toSheet(v, { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }, fitted.current.fit, SHEET_W, SHEET_H);
    const flip = flippedRef.current;
    const facing = Math.atan2(Math.tan(ty), Math.tan(tx)) - v.angle;
    return {
      // turned over, the sheet's left is on the screen's right
      x: flip ? SHEET_W - at.x : at.x,
      y: at.y,
      pressure: pen ? (e.pressure > 0 ? e.pressure : 0.5) : -1,
      tilt: pen ? lean : 0,
      // the lean is seen on the screen; the sheet may be turned (or turned over) under it
      tiltAngle: flip ? Math.PI - facing : facing,
      t: e.timeStamp,
    };
  };

  const moveCursor = (e: React.PointerEvent) => {
    const c = cursorRef.current;
    if (!c) return;
    // a finger covers its own spot: no outline under it
    c.classList.toggle("on", e.pointerType !== "touch");
    const r = active.current === null ? e.currentTarget.getBoundingClientRect() : box.current!;
    const scale = fitted.current.fit * view.current.scale;
    const d = Math.max(4, (brush.kind === "tool" ? 10 / scale : size) * scale);
    c.style.width = c.style.height = `${d}px`;
    c.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
  };

  const capture = (e: React.PointerEvent<HTMLElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser doesn't know (a synthetic one): carry on without capture */
    }
  };

  /** the fingers on the sheet changed: the gesture carries on from where they are now */
  const regrip = () => {
    const g = gesture.current;
    if (!g) return;
    g.ids = [...touches.current.keys()].slice(0, 2);
    g.start = view.current;
    if (g.ids.length < 2) return;
    const [a, b] = g.ids.map((id) => touches.current.get(id)!);
    g.a0 = local(a.x, a.y);
    g.b0 = local(b.x, b.y);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = painter.current;
    if (!p) return;
    if (swallow.current === e.pointerId) {
      swallow.current = null;
      return;
    }
    box.current = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === "mouse" && e.button === 1) {
      // the middle button drags the sheet around
      e.preventDefault();
      capture(e);
      pan.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: view.current };
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "pen") penSeen.current = true;
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp });
      capture(e);
      const g = gesture.current;
      if (g) {
        g.most = Math.max(g.most, touches.current.size);
        regrip();
        return;
      }
      const n = touches.current.size;
      const first = [...touches.current.values()][0];
      // two fingers together: a gesture, not a stroke. With a pen about, fingers only ever
      // move the sheet (but not while the pen is down).
      if (n >= 2 && (penSeen.current ? active.current === null : e.timeStamp - first.t < 250)) {
        p.cancel();
        active.current = null;
        gesture.current = { at: e.timeStamp, moved: false, most: n, ids: [], a0: { x: 0, y: 0 }, b0: { x: 0, y: 0 }, start: view.current };
        regrip();
        return;
      }
      // a hand resting on the screen while a pen draws isn't drawing
      if (n > 1 || penSeen.current) return;
    }
    if (active.current !== null) return;
    const at = sample(e, box.current);
    if (e.altKey && brush.kind !== "tool") {
      setColor(p.pick(at.x, at.y));
      return;
    }
    // filling or picking off the edge of the sheet does nothing
    if (brush.kind === "tool" && (at.x < 0 || at.y < 0 || at.x >= SHEET_W || at.y >= SHEET_H)) return;
    capture(e);
    active.current = e.pointerId;
    p.begin(at);
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    moveCursor(e);
    const pn = pan.current;
    if (pn && pn.id === e.pointerId) {
      apply({ ...pn.start, x: pn.start.x + e.clientX - pn.x, y: pn.start.y + e.clientY - pn.y });
      return;
    }
    const t = touches.current.get(e.pointerId);
    if (t) {
      t.x = e.clientX;
      t.y = e.clientY;
    }
    const g = gesture.current;
    if (t && g) {
      if (!g.moved) {
        // still maybe a tap: the sheet stays put until a finger really moves
        if (Math.hypot(t.x - t.sx, t.y - t.sy) <= 12) return;
        g.moved = true;
        regrip();
      }
      if (g.ids.length === 2 && g.ids.includes(e.pointerId)) {
        const [a, b] = g.ids.map((id) => touches.current.get(id)!);
        apply(twoFingers(g.start, g.a0, g.b0, local(a.x, a.y), local(b.x, b.y)));
      }
      return;
    }
    if (e.pointerId !== active.current || !box.current) return;
    const native = e.nativeEvent;
    const events = native.getCoalescedEvents?.() ?? [];
    const r = box.current;
    painter.current?.move((events.length ? events : [native]).map((ev) => sample(ev, r)));
  };

  /** a finger lifted: the end of a gesture is a tap (two undo, three redo) or the sheet settling */
  const lift = (e: React.PointerEvent<HTMLDivElement>, tapped: boolean) => {
    if (!touches.current.delete(e.pointerId)) return false;
    const g = gesture.current;
    if (!g) return false;
    if (touches.current.size > 0) {
      regrip();
      return true;
    }
    gesture.current = null;
    if (tapped && !g.moved && e.timeStamp - g.at < 350) {
      if (g.most >= 3) painter.current?.redo();
      else painter.current?.undo();
    } else settle();
    return true;
  };

  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pan.current?.id === e.pointerId) {
      pan.current = null;
      return;
    }
    if (lift(e, true)) return;
    if (e.pointerId !== active.current) return;
    active.current = null;
    painter.current?.end();
  };

  const cancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pan.current?.id === e.pointerId) pan.current = null;
    if (lift(e, false)) return;
    if (e.pointerId !== active.current) return;
    active.current = null;
    painter.current?.end();
  };

  // ─── settings ──────────────────────────────────────────────────

  const setSetting = (patch: Partial<{ size: number; opacity: number }>) =>
    setTools((all) => ({ ...all, [tool]: { size, opacity, ...patch } }));

  /** stay: the picker is still open, being dragged */
  const choose = (hex: string, custom = false, stay = false) => {
    setColor(hex);
    if (brushOf(tool).kind === "tool" && tool === "pick") setTool(lastBrush.current);
    if (tool === "eraser" || tool === "smudge") setTool(lastBrush.current === "eraser" ? "pencil" : lastBrush.current);
    if (custom) setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 6));
    else if (!stay) setPop((open) => (open === "colors" ? null : open));
  };

  // a tap anywhere outside the open popover (or its button) closes it
  useEffect(() => {
    if (!pop) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(`[data-pop="${pop}"]`)) return;
      setPop(null);
      if (t && windowRef.current?.contains(t)) swallow.current = e.pointerId;
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [pop]);

  useFitHeight(frameRef);

  // keys: a letter per tool, [ and ] for size, the usual undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const p = painter.current;
      if (!p) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) p.redo();
        else p.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        p.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "0") {
        resetView();
        return;
      }
      if (e.key === "Escape") {
        setPop(null);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        const b = brushOf(tool);
        const step = Math.max(1, Math.round(size * 0.15));
        const next = Math.max(b.size.min, Math.min(b.size.max, size + (e.key === "]" ? step : -step)));
        setTools((all) => ({ ...all, [tool]: { size: next, opacity } }));
        return;
      }
      const hit = BRUSHES.find((b) => b.key === e.key.toLowerCase());
      if (hit) setTool(hit.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, size, opacity, resetView]);

  // ─── the preview: a sample stroke, made by the real brush ─────

  const previewPainter = useRef<Painter | null>(null);
  useEffect(() => {
    const c = previewRef.current;
    if (!c) return;
    const t = window.setTimeout(() => {
      if (!previewPainter.current) previewPainter.current = new Painter(c, { width: 360, height: 96, paper });
      const pp = previewPainter.current;
      pp.setPaper(paper);
      pp.wipe();
      const b = brushOf(tool);
      if (b.kind === "tool") return;
      pp.tool = tool;
      pp.color = tool === "eraser" || tool === "smudge" ? "#1d1a24" : color;
      pp.size = Math.min(size, 70);
      pp.opacity = tool === "eraser" || tool === "smudge" ? 1 : opacity;
      pp.symmetry = false;
      if (tool === "eraser" || tool === "smudge") {
        // something to rub out first: a band of marker
        pp.tool = "marker";
        pp.size = 64;
        stroke(pp, 0.1, 0.9, 1, 0);
        pp.tool = tool;
        pp.size = Math.min(size, 50);
        pp.opacity = opacity;
      }
      stroke(pp, 0, 1, tool === "watercolor" ? 0.8 : 1);
    }, 40);
    return () => window.clearTimeout(t);
  }, [tool, color, size, opacity, paper]);

  // ─── what it looks like ───────────────────────────────────────

  const p = painter.current;
  const status = sending
    ? `${verb === "save" ? "saving" : "sending"}...`
    : problem
      ? problem
      : sentAt >= 0 && !unsent
        ? (verb === "save" ? "saved" : "sent")
        : sentAt >= 0
          ? `changed since you ${verb === "save" ? "saved" : "sent"} it`
          : null;

  const swatch = (c: string, recentOne = false) => (
    <button
      key={recentOne ? `r${c}` : c}
      className={`jqzz-draw-swatch${recentOne ? " recent" : ""}${color.toLowerCase() === c ? " on" : ""}`}
      style={{ "--swatch": c } as React.CSSProperties}
      onClick={() => choose(c)}
      aria-label={recentOne ? `recent ${c}` : c}
      aria-pressed={color.toLowerCase() === c}
    />
  );

  return (
    <div ref={frameRef} className={`jqzz-draw${brush.kind === "tool" ? " tool" : ""}`}>
      <div className="jqzz-draw-bar" role="toolbar" aria-label="actions">
        <button className="jqzz-draw-act" onClick={() => p?.undo()} disabled={!p?.canUndo} title="undo (Ctrl+Z, or tap with two fingers)">
          <ActionIcon name="undo" />
        </button>
        <button className="jqzz-draw-act" onClick={() => p?.redo()} disabled={!p?.canRedo} title="redo (Ctrl+Shift+Z, or tap with three fingers)">
          <ActionIcon name="redo" />
        </button>
        <span className="jqzz-draw-gap" />
        <button className="jqzz-draw-act" onClick={() => p?.clear()} disabled={!p || p.isEmpty} title="clear this layer">
          <ActionIcon name="clear" />
        </button>
        <button
          className={`jqzz-draw-act${flipped ? " on" : ""}`}
          onClick={() => {
            flippedRef.current = !flippedRef.current;
            setFlipped(flippedRef.current);
            apply(view.current, true);
          }}
          aria-pressed={flipped}
          title="flip: see it turned over left to right (the drawing stays as it is)"
        >
          <ActionIcon name="flip" />
        </button>
        <button className={`jqzz-draw-act${mirror ? " on" : ""}`} onClick={() => setMirror((m) => !m)} aria-pressed={mirror} title="mirror: draw both halves at once">
          <ActionIcon name="mirror" />
        </button>
        <div className="jqzz-draw-paper" data-pop="paper">
          <button className={`jqzz-draw-act${pop === "paper" ? " on" : ""}`} onClick={() => toggle("paper")} aria-expanded={pop === "paper"} title="paper">
            <ActionIcon name="paper" />
          </button>
          {pop === "paper" && (
            <div className="jqzz-draw-papers" role="menu">
              {PAPERS.map((pp) => (
                <button
                  key={pp.id}
                  role="menuitemradio"
                  aria-checked={paper === pp.id}
                  className={paper === pp.id ? "on" : ""}
                  onClick={() => {
                    setPaper(pp.id);
                    setPop(null);
                  }}
                >
                  <span className="jqzz-draw-paper-chip" style={{ background: pp.color }} />
                  {pp.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={`jqzz-draw-act with-count${pop === "layers" ? " on" : ""}`}
          onClick={() => toggle("layers")}
          aria-expanded={pop === "layers"}
          data-pop="layers"
          title="layers"
        >
          <ActionIcon name="layers" />
          {p && p.layers.length > 1 && <span className="jqzz-draw-count">{p.layers.length}</span>}
        </button>
        {onSend && (
          <button className="jqzz-play-btn primary jqzz-draw-send" disabled={!p || p.isEmpty || sending || !unsent} onClick={send}>
            {sentAt >= 0 && unsent ? (verb === "save" ? "save changes" : "send again") : sendLabel}
          </button>
        )}
      </div>

      <div
        ref={windowRef}
        className="jqzz-draw-window"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onPointerLeave={() => cursorRef.current?.classList.remove("on")}
        onPointerEnter={() => cursorRef.current?.classList.add("on")}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={sheetRef} className="jqzz-draw-sheet">
          <canvas ref={canvasRef} className="jqzz-draw-canvas" aria-label="drawing sheet" />
          {mirror && <div className="jqzz-draw-axis" aria-hidden="true" />}
        </div>
        <div ref={cursorRef} className="jqzz-draw-cursor" aria-hidden="true" />
      </div>

      {/* over the window, but not part of it: taps here never draw */}
      <div className="jqzz-draw-over">
        <button ref={zoomRef} className="jqzz-draw-zoom home" onClick={resetView} title="back to the whole sheet (0)">
          100%
        </button>
        {status && <span className="jqzz-draw-status jqzz-annot">{status}</span>}
        {pop === "layers" && p && (
          <div className="jqzz-draw-pop" data-pop="layers">
            <LayersPanel painter={p} revision={p.revision} />
          </div>
        )}
      </div>

      <div className="jqzz-draw-tools" role="toolbar" aria-label="tools">
        {BRUSHES.map((b) => (
          <button
            key={b.id}
            className={`jqzz-draw-tool${tool === b.id ? " on" : ""}`}
            onClick={() => setTool(b.id)}
            aria-pressed={tool === b.id}
            title={`${b.label} (${b.key.toUpperCase()})`}
          >
            <ToolIcon tool={b.id} />
            <span className="jqzz-draw-tool-name">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="jqzz-draw-tune">
        <div className="jqzz-draw-color" data-pop="colors">
          <button
            className={`jqzz-draw-swatch current${pop === "colors" ? " open" : ""}`}
            style={{ "--swatch": color } as React.CSSProperties}
            onClick={() => toggle("colors")}
            aria-expanded={pop === "colors"}
            aria-label="colours"
            title="colours"
          />
          <div className={`jqzz-draw-colors${pop === "colors" ? " open" : ""}`} role="group" aria-label="colours">
            {PALETTE.map((c) => swatch(c))}
            {recent.map((c) => swatch(c, true))}
            <button
              className={`jqzz-draw-swatch custom${pop === "picker" ? " open" : ""}`}
              title="any colour"
              aria-label="any colour"
              aria-expanded={pop === "picker"}
              data-pop="picker"
              style={{ "--swatch": color } as React.CSSProperties}
              onClick={() => toggle("picker")}
            />
          </div>
          {pop === "picker" && (
            <div className="jqzz-draw-picker" data-pop="picker" role="dialog" aria-label="any colour">
              <ColorPicker
                value={color}
                onChange={(hex) => choose(hex, false, true)}
                onDone={(hex) => setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 6))}
              />
            </div>
          )}
        </div>
        <canvas ref={previewRef} className="jqzz-draw-preview" aria-hidden="true" />
        {brush.kind !== "tool" ? (
          <div className="jqzz-draw-sliders">
            <label className="jqzz-draw-slider">
              <span>size</span>
              <input
                type="range"
                min={brush.size.min}
                max={brush.size.max}
                value={size}
                onChange={(e) => setSetting({ size: Number(e.target.value) })}
              />
              <output>{size}</output>
            </label>
            <label className="jqzz-draw-slider">
              <span>{tool === "smudge" ? "strength" : "opacity"}</span>
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setSetting({ opacity: Number(e.target.value) / 100 })}
              />
              <output>{Math.round(opacity * 100)}%</output>
            </label>
          </div>
        ) : (
          <p className="jqzz-draw-hint">
            {tool === "fill" ? "tap an area to fill it. on empty paper the colour goes under the lines." : "tap the sheet to take a colour from it. alt-click does it with any brush."}
          </p>
        )}
      </div>
    </div>
  );
});

/** a sample S-curve across the preview, heavy in the middle, light at the ends */
function stroke(p: Painter, from: number, to: number, weight: number, wave = 0.22) {
  const w = p.width;
  const h = p.height;
  const n = 48;
  const pt = (i: number): Sample => {
    const k = from + ((to - from) * i) / n;
    return {
      x: w * (0.06 + 0.88 * k),
      y: h / 2 + Math.sin(k * Math.PI * 2) * h * wave,
      pressure: Math.min(1, weight * (0.25 + 0.75 * Math.sin(k * Math.PI))),
      tilt: 0,
      tiltAngle: 0,
      t: i * 16,
    };
  };
  p.begin(pt(0));
  for (let i = 1; i <= n; i++) p.move([pt(i)]);
  p.end();
}
