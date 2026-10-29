import React, { useEffect, useRef, useState } from "react";
import { playService } from "../../services/playService";
import { Glyph } from "../common/Glyph";

/** pen colours, from the palette so they read in both themes */
const INKS = ["--accent", "--warm", "--ok", "--phase-ANSWER", "--phase-RESULT", "--text"];

/**
 * Something to do while you wait: draw on the screen's background. Once
 * you're done with the step a pen shows up; with it on you draw over
 * everything, and when you put it down the drawing stays behind the game.
 * The host sees who's drawing. A new question takes the pen away again.
 */
export const Doodle: React.FC<{ code: string; me: string; allowed: boolean }> = ({ code, me, allowed }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [ink, setInk] = useState(INKS[0]);
  const [blank, setBlank] = useState(true);
  const drawing = on && allowed;

  // the host sees who's drawing; tell it when that changes, and when we go
  const told = useRef(false);
  useEffect(() => {
    if (drawing === told.current) return;
    told.current = drawing;
    playService.drawing(code, me, drawing).catch(() => {});
  }, [drawing, code, me]);
  useEffect(
    () => () => {
      if (told.current) playService.drawing(code, me, false).catch(() => {});
    },
    [code, me],
  );

  // a new question: the pen goes down, the drawing stays
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!allowed) setOn(false);
  }, [allowed]);

  // sized to the screen in device pixels; a resize keeps what's drawn
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (c.width === w && c.height === h) return;
      const keep = document.createElement("canvas");
      keep.width = c.width;
      keep.height = c.height;
      if (c.width && c.height) keep.getContext("2d")!.drawImage(c, 0, 0);
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(keep, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const last = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);
  const at = (e: React.PointerEvent) => {
    const dpr = canvas.current!.width / window.innerWidth;
    return { x: e.clientX * dpr, y: e.clientY * dpr, dpr };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y, dpr } = at(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(ink).trim() || "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    last.current = { x, y, mx: x, my: y };
    setBlank(false);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = last.current;
    if (!p || !drawing) return;
    const { x, y, dpr } = at(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(ink).trim() || "#fff";
    ctx.lineWidth = 5 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // through the midpoints, so fast strokes curve instead of zigzagging
    const mx = (p.x + x) / 2;
    const my = (p.y + y) / 2;
    ctx.beginPath();
    ctx.moveTo(p.mx, p.my);
    ctx.quadraticCurveTo(p.x, p.y, mx, my);
    ctx.stroke();
    last.current = { x, y, mx, my };
  };
  const up = () => {
    last.current = null;
  };
  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setBlank(true);
  };

  return (
    <>
      {drawing && <div className="jqzz-doodle-scrim" aria-hidden="true" />}
      <canvas
        ref={canvas}
        className={`jqzz-doodle${drawing ? " drawing" : ""}`}
        aria-hidden="true"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {allowed && (
        <div className={`jqzz-doodle-tools${drawing ? " open" : ""}`}>
          {drawing && (
            <>
              <div className="jqzz-doodle-inks" role="radiogroup" aria-label="Pen colour">
                {INKS.map((v) => (
                  <button
                    key={v}
                    className={`jqzz-doodle-ink${ink === v ? " on" : ""}`}
                    style={{ "--ink": `var(${v})` } as React.CSSProperties}
                    role="radio"
                    aria-checked={ink === v}
                    aria-label={v.replace(/^--(phase-)?/, "").toLowerCase()}
                    onClick={() => setInk(v)}
                  />
                ))}
              </div>
              <button className="jqzz-play-btn small ghost" onClick={clear} disabled={blank}>
                clear
              </button>
            </>
          )}
          <button
            className={`jqzz-play-btn small${drawing ? " primary" : ""}`}
            onClick={() => setOn((v) => !v)}
            aria-pressed={drawing}
            title={drawing ? "put the pen down: the drawing stays behind" : "draw on the background while you wait"}
          >
            <Glyph name="PEN" size={13} /> {drawing ? "done" : "draw"}
          </button>
        </div>
      )}
    </>
  );
};
