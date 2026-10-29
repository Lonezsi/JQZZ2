import React, { useEffect, useRef } from "react";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { onThemeChange } from "../../utils/theme";

/** how long a trail takes to fade away */
const TRAIL_MS = 1400;
/** how often a stroke's new points go out */
const SEND_MS = 50;
/** a finger has to rest this long before it draws instead of scrolling */
const HOLD_MS = 180;
/** everyone gets their own colour, from the palette so it reads in both themes */
const INKS = ["--accent", "--warm", "--ok", "--phase-ANSWER", "--phase-RESULT", "--phase-SETTING"];

/** not the background: dragging on these does what they do */
const NOT_BACKGROUND =
  "button, a, input, textarea, select, label, [role=button], [role=switch], [contenteditable], [draggable=true], .jqzz-tile, .jqzz-tier-item, .jqzz-chip, .jqzz-board-row, img";

function inkOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return INKS[Math.abs(h) % INKS.length];
}

interface Point {
  x: number;
  y: number;
  t: number;
}

/**
 * Trails on the background of a game's screen. Once a player is done with the
 * step they can drag on any empty part of it and a fading trail follows; the
 * trail shows on everyone's screen at the game, the host's too. Nothing is
 * kept: every trail is gone a moment after it's drawn.
 *
 * `canDraw`: this screen's own player may draw now. Everyone sees everyone else's.
 * `onTrail`: someone's trail came in (the host shows who's drawing).
 */
export const Doodle: React.FC<{
  code: string;
  me: string;
  canDraw: boolean;
  onTrail?: (from: string) => void;
}> = ({ code, me, canDraw, onTrail }) => {
  const { client, subscribe, connected } = useWebSocket();
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef(new Map<string, { ink: string; points: Point[] }>());
  const frame = useRef(0);
  const colours = useRef(new Map<string, string>());
  const onTrailRef = useRef(onTrail);
  useEffect(() => {
    onTrailRef.current = onTrail;
  });

  // ─── drawing what's there, fading as it goes ──────────────────────────
  const paint = useRef<() => void>(() => {});
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const colour = (v: string) => {
      let got = colours.current.get(v);
      if (!got) {
        got = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#b9a6ff";
        colours.current.set(v, got);
      }
      return got;
    };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
    };
    const draw = () => {
      frame.current = 0;
      const now = performance.now();
      const w = c.width;
      const h = c.height;
      const base = Math.max(3, Math.min(w, h) * 0.012);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      let live = false;
      for (const [key, s] of strokes.current) {
        const pts = s.points.filter((p) => now - p.t < TRAIL_MS);
        s.points = pts;
        if (pts.length === 0) {
          strokes.current.delete(key);
          continue;
        }
        live = true;
        ctx.strokeStyle = colour(s.ink);
        ctx.fillStyle = ctx.strokeStyle;
        if (pts.length === 1) {
          const life = 1 - (now - pts[0].t) / TRAIL_MS;
          ctx.globalAlpha = life;
          ctx.beginPath();
          ctx.arc(pts[0].x * w, pts[0].y * h, (base * life) / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        // segment by segment: older ones thinner and fainter, so it reads as a trail
        for (let i = 1; i < pts.length; i++) {
          const life = 1 - (now - pts[i].t) / TRAIL_MS;
          ctx.globalAlpha = Math.max(0, life);
          ctx.lineWidth = base * (0.25 + 0.75 * life);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x * w, pts[i - 1].y * h);
          ctx.lineTo(pts[i].x * w, pts[i].y * h);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (live) frame.current = requestAnimationFrame(draw);
    };
    paint.current = () => {
      if (!frame.current) frame.current = requestAnimationFrame(draw);
    };
    fit();
    window.addEventListener("resize", fit);
    const offTheme = onThemeChange(() => colours.current.clear());
    return () => {
      window.removeEventListener("resize", fit);
      offTheme();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  // ─── everyone else's trails ───────────────────────────────────────────
  useEffect(() => {
    const sub = subscribe(`/topic/play/${code}/doodle`, (msg) => {
      const m = JSON.parse(msg.body) as { from: string; stroke: string; points: [number, number][] };
      if (m.from === me || !m.points?.length) return;
      const key = `${m.from}:${m.stroke}`;
      const s = strokes.current.get(key) ?? { ink: inkOf(m.from), points: [] };
      // a batch covers the last SEND_MS: spread it out so it fades smoothly
      const now = performance.now();
      const n = m.points.length;
      m.points.forEach(([x, y], i) => s.points.push({ x, y, t: now - SEND_MS + ((i + 1) * SEND_MS) / n }));
      strokes.current.set(key, s);
      paint.current();
      onTrailRef.current?.(m.from);
    });
    return () => sub?.unsubscribe();
  }, [code, me, subscribe, connected]);

  // ─── your own: drag on the background ────────────────────────────────
  useEffect(() => {
    if (!canDraw) return;
    let active: { id: number; key: string; stroke: string } | null = null;
    let outbox: [number, number][] = [];
    let held: { id: number; x: number; y: number; timer: number } | null = null;
    let n = 0;

    const flush = () => {
      if (!active || outbox.length === 0 || !client?.connected) {
        outbox = [];
        return;
      }
      client.publish({
        destination: `/app/play/${code}/doodle`,
        body: JSON.stringify({ stroke: active.stroke, points: outbox }),
      });
      // the next batch starts where this one ended, so the line has no gaps
      outbox = outbox.slice(-1);
    };
    const sender = window.setInterval(flush, SEND_MS);

    const add = (clientX: number, clientY: number) => {
      if (!active) return;
      const x = clientX / window.innerWidth;
      const y = clientY / window.innerHeight;
      const s = strokes.current.get(active.key)!;
      s.points.push({ x, y, t: performance.now() });
      outbox.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
      paint.current();
    };
    const begin = (id: number, x: number, y: number) => {
      const stroke = `${Date.now().toString(36)}${n++}`;
      active = { id, key: `${me}:${stroke}`, stroke };
      strokes.current.set(active.key, { ink: inkOf(me), points: [] });
      outbox = [];
      add(x, y);
    };
    const end = (e: PointerEvent) => {
      if (held && held.id === e.pointerId) {
        window.clearTimeout(held.timer);
        held = null;
      }
      if (active && active.id === e.pointerId) {
        flush();
        active = null;
        outbox = [];
      }
    };

    const down = (e: PointerEvent) => {
      if (active || e.button !== 0 || !e.isPrimary) return;
      const target = e.target as Element | null;
      if (!target?.closest(".jqzz-play") || target.closest(NOT_BACKGROUND)) return;
      if (e.pointerType === "mouse" || e.pointerType === "pen") {
        e.preventDefault(); // no text selection while dragging
        begin(e.pointerId, e.clientX, e.clientY);
        return;
      }
      // a finger: rest a moment to draw, or swipe away to scroll as usual
      const id = e.pointerId;
      held = {
        id,
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          if (!held || held.id !== id) return;
          const { x, y } = held;
          held = null;
          begin(id, x, y);
        }, HOLD_MS),
      };
    };
    const move = (e: PointerEvent) => {
      if (held && held.id === e.pointerId && Math.hypot(e.clientX - held.x, e.clientY - held.y) > 10) {
        window.clearTimeout(held.timer);
        held = null;
      }
      if (active && active.id === e.pointerId) add(e.clientX, e.clientY);
    };
    // while a finger draws, the page must not scroll under it
    const touchmove = (e: TouchEvent) => {
      if (active) e.preventDefault();
    };

    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", touchmove, { passive: false });
    return () => {
      window.clearInterval(sender);
      if (held) window.clearTimeout(held.timer);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", touchmove);
    };
  }, [canDraw, client, code, me]);

  return <canvas ref={canvas} className="jqzz-doodle" aria-hidden="true" />;
};
