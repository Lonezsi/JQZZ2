import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BRUSHES, brushOf, type ToolId } from "./brushes";
import { Painter, type Sample } from "./painter";
import { PAPERS } from "./paper";
import { ActionIcon, ToolIcon } from "./icons";

/*
 * The drawing frame: a sheet of paper and a box of tools. Everything here
 * is the controls; the marks themselves are made by the Painter.
 */

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
  /** server time it's due: whatever is drawn goes by itself just before */
  dueAt?: number | null;
  serverNow?: () => number;
}

export const DrawingFrame = forwardRef<DrawingFrameHandle, Props>(function DrawingFrame(
  { keepAs, start, onSend, sendLabel = "send", dueAt, serverNow },
  ref,
) {
  const viewRef = useRef<HTMLCanvasElement>(null);
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
  const [papers, setPapers] = useState(false);
  const [, setTick] = useState(0);
  const [sentAt, setSentAt] = useState(-1);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const brush = brushOf(tool);
  const size = tools[tool]?.size ?? brush.size.start;
  const opacity = tools[tool]?.opacity ?? brush.opacity;

  // ─── the painter ───────────────────────────────────────────────

  useEffect(() => {
    const p = new Painter(viewRef.current!, { width: SHEET_W, height: SHEET_H, paper: kept.current.paper });
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
    if (from) p.load(from).catch(() => {});
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

  const box = useRef<DOMRect | null>(null);
  const active = useRef<number | null>(null);
  const penSeen = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number; t: number }>());
  const gesture = useRef<{ at: number; moved: boolean } | null>(null);

  const sample = (e: PointerEvent | React.PointerEvent, r: DOMRect): Sample => {
    const pen = e.pointerType === "pen";
    // altitude: how far the pen leans away from upright
    const tx = (e.tiltX ?? 0) * (Math.PI / 180);
    const ty = (e.tiltY ?? 0) * (Math.PI / 180);
    const lean = Math.min(1, Math.hypot(Math.tan(tx), Math.tan(ty)) / 2.2);
    return {
      x: ((e.clientX - r.left) / r.width) * SHEET_W,
      y: ((e.clientY - r.top) / r.height) * SHEET_H,
      pressure: pen ? (e.pressure > 0 ? e.pressure : 0.5) : -1,
      tilt: pen ? lean : 0,
      tiltAngle: Math.atan2(Math.tan(ty), Math.tan(tx)),
      t: e.timeStamp,
    };
  };

  const moveCursor = (e: React.PointerEvent) => {
    const c = cursorRef.current;
    if (!c) return;
    // a finger covers its own spot: no outline under it
    c.classList.toggle("on", e.pointerType !== "touch");
    const r = active.current === null ? e.currentTarget.getBoundingClientRect() : box.current!;
    const scale = r.width / SHEET_W;
    const d = Math.max(4, (brush.kind === "tool" ? 10 / scale : size) * scale);
    c.style.width = c.style.height = `${d}px`;
    c.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = painter.current;
    if (!p) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "pen") penSeen.current = true;
    // a hand resting on the screen while a pen draws isn't drawing
    if (e.pointerType === "touch" && penSeen.current) return;
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
      const first = [...touches.current.values()][0];
      if (touches.current.size === 2 && e.timeStamp - first.t < 250) {
        // two fingers together: a gesture, not a stroke. A quick tap of two undoes.
        p.cancel();
        active.current = null;
        gesture.current = { at: e.timeStamp, moved: false };
        return;
      }
      if (touches.current.size > 1) return;
    }
    if (active.current !== null) return;
    box.current = e.currentTarget.getBoundingClientRect();
    const at = sample(e, box.current);
    if (e.altKey && brush.kind !== "tool") {
      setColor(p.pick(at.x, at.y));
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser doesn't know (a synthetic one): draw without capture */
    }
    active.current = e.pointerId;
    p.begin(at);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    moveCursor(e);
    const t = touches.current.get(e.pointerId);
    if (t && gesture.current && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) gesture.current.moved = true;
    if (e.pointerId !== active.current || !box.current) return;
    const native = e.nativeEvent;
    const events = native.getCoalescedEvents?.() ?? [];
    const r = box.current;
    painter.current?.move((events.length ? events : [native]).map((ev) => sample(ev, r)));
  };

  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.pointerId);
    const g = gesture.current;
    if (g && touches.current.size === 0) {
      gesture.current = null;
      if (!g.moved && e.timeStamp - g.at < 350) painter.current?.undo();
    }
    if (e.pointerId !== active.current) return;
    active.current = null;
    painter.current?.end();
  };

  const cancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.pointerId);
    if (e.pointerId !== active.current) return;
    active.current = null;
    painter.current?.end();
  };

  // ─── settings ──────────────────────────────────────────────────

  const setSetting = (patch: Partial<{ size: number; opacity: number }>) =>
    setTools((all) => ({ ...all, [tool]: { size, opacity, ...patch } }));

  const choose = (hex: string, custom = false) => {
    setColor(hex);
    if (brushOf(tool).kind === "tool" && tool === "pick") setTool(lastBrush.current);
    if (tool === "eraser" || tool === "smudge") setTool(lastBrush.current === "eraser" ? "pencil" : lastBrush.current);
    if (custom) setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 6));
  };

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
  }, [tool, size, opacity]);

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
  const status = sending ? "sending..." : problem ? problem : sentAt >= 0 && !unsent ? "sent" : sentAt >= 0 ? "changed since you sent it" : null;

  return (
    <div className="jqzz-draw">
      <div className={`jqzz-draw-sheet${brush.kind === "tool" ? " tool" : ""}`}>
        <canvas
          ref={viewRef}
          className="jqzz-draw-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          onPointerLeave={() => cursorRef.current?.classList.remove("on")}
          onPointerEnter={() => cursorRef.current?.classList.add("on")}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="drawing sheet"
        />
        <div ref={cursorRef} className="jqzz-draw-cursor" aria-hidden="true" />
        {mirror && <div className="jqzz-draw-axis" aria-hidden="true" />}
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

      <div className="jqzz-draw-colors" role="group" aria-label="colours">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`jqzz-draw-swatch${color.toLowerCase() === c ? " on" : ""}`}
            style={{ "--swatch": c } as React.CSSProperties}
            onClick={() => choose(c)}
            aria-label={c}
            aria-pressed={color.toLowerCase() === c}
          />
        ))}
        {recent.map((c) => (
          <button
            key={`r${c}`}
            className={`jqzz-draw-swatch recent${color.toLowerCase() === c ? " on" : ""}`}
            style={{ "--swatch": c } as React.CSSProperties}
            onClick={() => choose(c)}
            aria-label={`recent ${c}`}
          />
        ))}
        <label className="jqzz-draw-swatch custom" title="any colour" style={{ "--swatch": color } as React.CSSProperties}>
          <input type="color" value={color} onChange={(e) => choose(e.target.value, true)} aria-label="any colour" />
        </label>
      </div>

      <div className="jqzz-draw-actions">
        <button className="jqzz-draw-act" onClick={() => p?.undo()} disabled={!p?.canUndo} title="undo (Ctrl+Z, or tap with two fingers)">
          <ActionIcon name="undo" />
        </button>
        <button className="jqzz-draw-act" onClick={() => p?.redo()} disabled={!p?.canRedo} title="redo (Ctrl+Shift+Z)">
          <ActionIcon name="redo" />
        </button>
        <button className="jqzz-draw-act" onClick={() => p?.clear()} disabled={!p || p.isEmpty} title="clear the sheet">
          <ActionIcon name="clear" />
        </button>
        <button className={`jqzz-draw-act${mirror ? " on" : ""}`} onClick={() => setMirror((m) => !m)} aria-pressed={mirror} title="mirror: draw both halves at once">
          <ActionIcon name="mirror" />
        </button>
        <div className="jqzz-draw-paper">
          <button className={`jqzz-draw-act${papers ? " on" : ""}`} onClick={() => setPapers((o) => !o)} aria-expanded={papers} title="paper">
            <ActionIcon name="paper" />
          </button>
          {papers && (
            <div className="jqzz-draw-papers" role="menu">
              {PAPERS.map((pp) => (
                <button
                  key={pp.id}
                  role="menuitemradio"
                  aria-checked={paper === pp.id}
                  className={paper === pp.id ? "on" : ""}
                  onClick={() => {
                    setPaper(pp.id);
                    setPapers(false);
                  }}
                >
                  <span className="jqzz-draw-paper-chip" style={{ background: pp.color }} />
                  {pp.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {onSend && (
          <div className="jqzz-draw-send">
            {status && <span className="jqzz-annot">{status}</span>}
            <button className="jqzz-play-btn primary" disabled={!p || p.isEmpty || sending || !unsent} onClick={send}>
              {sentAt >= 0 && unsent ? "send again" : sendLabel}
            </button>
          </div>
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
