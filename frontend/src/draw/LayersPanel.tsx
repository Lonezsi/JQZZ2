import React, { useEffect, useRef } from "react";
import { BLENDS, MAX_LAYERS, type Layer, type Painter } from "./painter";
import { ActionIcon } from "./icons";

/** a layer, small: redrawn whenever the drawing changes */
const Thumb: React.FC<{ layer: Layer; revision: number }> = ({ layer, revision }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(layer.canvas, 0, 0, c.width, c.height);
  }, [layer, revision]);
  return <canvas ref={ref} className="jqzz-layer-thumb" width={64} height={48} aria-hidden="true" />;
};

/**
 * The drawing's layers, top first as they stack: pick the one to draw on,
 * hide one, change how it blends with what's under it, how strongly, or lock
 * it so paint only lands where it already has paint.
 */
export const LayersPanel: React.FC<{ painter: Painter; revision: number }> = ({ painter: p, revision }) => {
  const layer = p.layer;
  const top = p.layers.length - 1;
  return (
    <section className="jqzz-draw-layers" aria-label="layers">
      <div className="jqzz-layers-bar">
        <span className="jqzz-annot">
          layers · {p.layers.length}/{MAX_LAYERS}
        </span>
        <span className="jqzz-layers-acts">
          <button className="jqzz-draw-act small" onClick={() => p.addLayer()} disabled={p.layers.length >= MAX_LAYERS} title="a new layer, above this one">
            <ActionIcon name="add" size={16} />
          </button>
          <button className="jqzz-draw-act small" onClick={() => p.duplicateLayer()} disabled={p.layers.length >= MAX_LAYERS} title="a copy of this layer">
            <ActionIcon name="duplicate" size={16} />
          </button>
          <button className="jqzz-draw-act small" onClick={() => p.mergeDown()} disabled={p.active === 0} title="merge into the layer below">
            <ActionIcon name="merge" size={16} />
          </button>
          <button className="jqzz-draw-act small" onClick={() => p.moveLayer(1)} disabled={p.active === top} title="move up">
            <ActionIcon name="up" size={16} />
          </button>
          <button className="jqzz-draw-act small" onClick={() => p.moveLayer(-1)} disabled={p.active === 0} title="move down">
            <ActionIcon name="down" size={16} />
          </button>
          <button className="jqzz-draw-act small" onClick={() => p.deleteLayer()} disabled={p.layers.length <= 1} title="delete this layer">
            <ActionIcon name="clear" size={16} />
          </button>
        </span>
      </div>

      <ol className="jqzz-layer-list">
        {[...p.layers].reverse().map((l) => {
          const i = p.layers.indexOf(l);
          const on = i === p.active;
          return (
            <li key={l.id} className={`jqzz-layer${on ? " on" : ""}${l.visible ? "" : " hidden"}`}>
              <button className="jqzz-layer-pick" onClick={() => p.selectLayer(i)} aria-pressed={on} title={on ? "you're drawing on this one" : "draw on this one"}>
                <Thumb layer={l} revision={revision} />
                <span className="jqzz-layer-name">{l.name}</span>
                <span className="jqzz-annot">
                  {BLENDS.find((b) => b.id === l.blend)?.label ?? "normal"}
                  {l.opacity < 1 ? ` · ${Math.round(l.opacity * 100)}%` : ""}
                  {l.lockAlpha ? " · locked" : ""}
                </span>
              </button>
              <button
                className="jqzz-draw-act small ghost"
                onClick={() => p.setLayer({ visible: !l.visible }, i)}
                aria-pressed={!l.visible}
                title={l.visible ? "hide it" : "show it"}
              >
                <ActionIcon name={l.visible ? "eye" : "hidden"} size={16} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="jqzz-layer-tune">
        <label className="jqzz-draw-slider">
          <span>opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => p.setLayer({ opacity: Number(e.target.value) / 100 })}
          />
          <output>{Math.round(layer.opacity * 100)}%</output>
        </label>
        <label className="jqzz-layer-blend">
          <span className="jqzz-annot">blend</span>
          <select value={layer.blend} onChange={(e) => p.setLayer({ blend: e.target.value as GlobalCompositeOperation })}>
            {BLENDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`jqzz-draw-act${layer.lockAlpha ? " on" : ""}`}
          onClick={() => p.setLayer({ lockAlpha: !layer.lockAlpha })}
          aria-pressed={layer.lockAlpha}
          title="lock: paint only lands where this layer already has paint"
        >
          <ActionIcon name="lock" />
        </button>
      </div>
    </section>
  );
};
