import React, { useEffect, useRef, useState } from "react";
import { fit, hexOfLch, inGamut, labOfLch, lchOfHex, rgbOfLab, type Lch } from "./oklab";

/** the most chroma the square shows: a little past sRGB's most vivid */
const MAX_C = 0.37;
/** the square's pixels: drawn small, shown big (it's a smooth field) */
const N = 128;
/** every hue at one lightness and chroma, for the strip */
const HUES = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => hexOfLch({ L: 0.72, C: 0.14, H: i * 30 })).join(", ")})`;

/**
 * Any colour, picked the way eyes see colour (OKLCH): a square of lightness
 * (up) by chroma (across) at one hue, a strip of hues under it, and the
 * colour as hex to type or paste. Equal steps look equal, so there's no
 * corner that's all one muddy shade. Colours a screen can't show are dimmed
 * in the square; picked anyway, they come in to the nearest one it can, at
 * the same lightness and hue.
 */
export const ColorPicker: React.FC<{ value: string; onChange: (hex: string) => void; onDone?: (hex: string) => void }> = ({
  value,
  onChange,
  onDone,
}) => {
  // the hue is kept while the colour is grey, where hex alone would forget it
  const [lch, setLch] = useState<Lch>(() => lchOfHex(value));
  const [typed, setTyped] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (value.toLowerCase() === last.current.toLowerCase()) return;
    last.current = value;
    const next = lchOfHex(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLch((was) => (next.C < 0.02 ? { ...next, H: was.H } : next));
    setTyped(value);
  }, [value]);

  const put = (next: Lch, done = false) => {
    setLch(next);
    const hex = hexOfLch(next);
    last.current = hex;
    setTyped(hex);
    onChange(hex);
    if (done) onDone?.(hex);
  };

  // the square, at this hue
  const square = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = square.current?.getContext("2d");
    if (!c) return;
    const img = c.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      const L = 1 - y / (N - 1);
      for (let x = 0; x < N; x++) {
        const lab = labOfLch({ L, C: (x / (N - 1)) * MAX_C, H: lch.H });
        const [r, g, b] = rgbOfLab(lab);
        const i = (y * N + x) * 4;
        // past what a screen can show: dimmed, so the edge of the possible shows
        const out = !inGamut(lab);
        img.data[i] = out ? r * 0.35 + 30 : r;
        img.data[i + 1] = out ? g * 0.35 + 30 : g;
        img.data[i + 2] = out ? b * 0.35 + 34 : b;
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, [lch.H]);

  const drag = (el: HTMLElement, e: React.PointerEvent, at: (fx: number, fy: number) => Lch) => {
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const read = (ev: { clientX: number; clientY: number }) =>
      at(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    put(read(e));
    const move = (ev: PointerEvent) => put(read(ev));
    const up = (ev: PointerEvent) => {
      // let go somewhere a screen can't show: it comes in to the nearest it can
      put(fit(read(ev)), true);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const nudge = (e: React.KeyboardEvent, axis: "L" | "C" | "H") => {
    const step = { L: 0.02, C: 0.01, H: 4 }[axis] * (e.shiftKey ? 4 : 1);
    const dir = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const v = lch[axis] + dir * step;
    put(
      fit({
        ...lch,
        [axis]: axis === "H" ? (v + 360) % 360 : Math.min(axis === "L" ? 1 : MAX_C, Math.max(0, v)),
      }),
      true,
    );
  };

  const shown = fit(lch);
  return (
    <div className="jqzz-colorpick">
      <div
        className="jqzz-colorpick-square"
        role="slider"
        tabIndex={0}
        aria-label="lightness and colourfulness"
        aria-valuetext={`lightness ${Math.round(shown.L * 100)}, chroma ${shown.C.toFixed(2)}`}
        onPointerDown={(e) => drag(e.currentTarget, e, (fx, fy) => ({ L: 1 - fy, C: fx * MAX_C, H: lch.H }))}
        onKeyDown={(e) => nudge(e, e.key === "ArrowUp" || e.key === "ArrowDown" ? "L" : "C")}
      >
        <canvas ref={square} width={N} height={N} aria-hidden="true" />
        <span
          className="jqzz-colorpick-dot"
          style={{ left: `${(lch.C / MAX_C) * 100}%`, top: `${(1 - lch.L) * 100}%`, background: hexOfLch(lch) }}
          aria-hidden="true"
        />
      </div>
      <div
        className="jqzz-colorpick-hue"
        style={{ background: HUES }}
        role="slider"
        tabIndex={0}
        aria-label="hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(lch.H)}
        onPointerDown={(e) => drag(e.currentTarget, e, (fx) => ({ ...lch, H: fx * 360 }))}
        onKeyDown={(e) => nudge(e, "H")}
      >
        <span className="jqzz-colorpick-hue-dot" style={{ left: `${(lch.H / 360) * 100}%` }} aria-hidden="true" />
      </div>
      <div className="jqzz-colorpick-row">
        <span className="jqzz-colorpick-now" style={{ background: value }} aria-hidden="true" />
        <input
          className="jqzz-colorpick-hex"
          value={typed}
          aria-label="hex"
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setTyped(v);
            const hex = v.startsWith("#") ? v : `#${v}`;
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
              const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
              put(lchOfHex(full.toLowerCase()), true);
            }
          }}
        />
        <span className="jqzz-colorpick-lch jqzz-annot" aria-hidden="true">
          L {Math.round(shown.L * 100)} · C {shown.C.toFixed(2)} · H {Math.round(lch.H)}
        </span>
      </div>
    </div>
  );
};
