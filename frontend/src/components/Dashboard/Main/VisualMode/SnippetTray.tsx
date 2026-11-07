import React, { useState } from "react";
import { useTypes } from "../../../../hooks/useTypes";
import type { TypeShape } from "../../../../types/stash";
import { FALLBACK_TYPES, readType } from "../../../../utils/stashContent";
import { plural } from "../../../../utils/format";
import {
  FAMILIES,
  PRESETS,
  describe,
  familyOf,
  modeKey,
  modeOf,
  starterShape,
  type FamilyId,
  type Mode,
} from "../../../../utils/questionTypes";
import { Glyph } from "../../../common/Glyph";

export const DRAG_SNIPPET_KEY = "jqzz-snippet";

interface SnippetTrayProps {
  onPick: (snippetId: string) => void;
}

/** one kind of question, and the saved shapes of it */
interface Kind {
  mode: Mode;
  /** what a click on the row adds: your first shape of it, or a starter */
  main: TypeShape;
  /** your other shapes of the same kind ("lightning round", "true / false") */
  variants: TypeShape[];
}

const FAMILY_KEY = "jqzz-type-family";
const lastFamily = (): FamilyId => {
  try {
    const v = localStorage.getItem(FAMILY_KEY);
    if (FAMILIES.some((f) => f.id === v)) return v as FamilyId;
  } catch {
    /* no storage: start on the first */
  }
  return "quiz";
};

const idOf = (t: TypeShape) => `type:${JSON.stringify(t)}`;
const modeOfShape = (t: TypeShape) => modeOf({ type: t.questionType, mode: t.mode });
const seconds = (t: TypeShape) => t.steps.reduce((sum, step) => sum + step.time, 0);

/**
 * Which family a kind sits in, in the tray. "who was it" scores right, which
 * would put it with the quiz questions, but it guesses who wrote an earlier
 * answer: it belongs with "who wrote it", right after it.
 */
const WHO_WAS_IT = "person/right";
const WHO_WROTE = "write/authors";
const trayFamily = (mode: Mode): FamilyId => (modeKey(mode) === WHO_WAS_IT ? "write" : familyOf(mode));

/** your saved shapes and the built-in kinds, one row per kind, sorted into families */
function kindsByFamily(yours: TypeShape[]): Map<FamilyId, Kind[]> {
  const kinds = new Map<string, Kind>();
  for (const t of yours) {
    const mode = modeOfShape(t);
    const k = kinds.get(modeKey(mode));
    if (k) k.variants.push(t);
    else kinds.set(modeKey(mode), { mode, main: t, variants: [] });
  }
  // every kind there is, even the ones your stash has no shape of yet, in the registry's order
  const ordered: Kind[] = [];
  for (const p of PRESETS) {
    const key = modeKey(p.mode);
    ordered.push(kinds.get(key) ?? { mode: p.mode, main: starterShape(p), variants: [] });
    kinds.delete(key);
  }
  ordered.push(...kinds.values()); // your own pairs no preset names
  const who = ordered.findIndex((k) => modeKey(k.mode) === WHO_WAS_IT);
  if (who >= 0) {
    const [kind] = ordered.splice(who, 1);
    ordered.splice(ordered.findIndex((k) => modeKey(k.mode) === WHO_WROTE) + 1, 0, kind);
  }
  const out = new Map<FamilyId, Kind[]>(FAMILIES.map((f) => [f.id, []]));
  ordered.forEach((k) => out.get(trayFamily(k.mode))!.push(k));
  return out;
}

/** a bar of a shape's phases, widths by their time */
const PhaseStrip: React.FC<{ shape: TypeShape }> = ({ shape }) => (
  <span className="jqzz-phase-strip" aria-hidden="true">
    {shape.steps.map((step, j) => (
      <span key={j} style={{ flexGrow: Math.max(step.time, 1), background: `var(--phase-${step.phase})` }} />
    ))}
  </span>
);

const dragProps = (id: string) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_SNIPPET_KEY, id);
    e.dataTransfer.effectAllowed = "copy";
  },
});

/**
 * Picking a question's kind. Twenty-odd kinds side by side was a wall to
 * read, so it asks one thing first (what kind of question), then shows only
 * the handful in that family, one row each, your saved variations of a kind
 * as small chips on its row. Click to add at the end, or drag one in.
 */
export const SnippetTray: React.FC<SnippetTrayProps> = ({ onPick }) => {
  const stashed = useTypes();
  const yours: TypeShape[] = stashed && stashed.length > 0 ? stashed.map((t) => readType(t)) : FALLBACK_TYPES;
  const families = kindsByFamily(yours);
  const [family, setFamily] = useState<FamilyId>(lastFamily);
  const choose = (f: FamilyId) => {
    setFamily(f);
    try {
      localStorage.setItem(FAMILY_KEY, f);
    } catch {
      /* fine, it just won't be remembered */
    }
  };
  const kinds = families.get(family) ?? [];

  return (
    <div className="jqzz-types">
      <div className="jqzz-type-families" role="tablist" aria-label="What kind of question">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={f.id === family}
            className="jqzz-type-family"
            onClick={() => choose(f.id)}
          >
            <Glyph name={f.icon} size={16} />
            <span className="jqzz-type-family-label">{f.label}</span>
            <span className="jqzz-annot">{f.blurb}</span>
          </button>
        ))}
      </div>

      <div className="jqzz-type-kinds" role="tabpanel" key={family}>
        {kinds.map((k, i) => {
          const d = describe(k.mode);
          return (
            <div key={modeKey(k.mode)} className="jqzz-type-kind" style={{ "--i": i } as React.CSSProperties}>
              <button
                className="jqzz-snippet"
                {...dragProps(idOf(k.main))}
                onClick={() => onPick(idOf(k.main))}
                aria-label={`Add ${d.label}: ${d.blurb}`}
              >
                <span className="jqzz-snippet-icon" aria-hidden="true">
                  <Glyph name={d.icon} size={15} />
                </span>
                <span className="jqzz-snippet-text">
                  <span className="jqzz-snippet-name">{d.label}</span>
                  <span className="jqzz-snippet-blurb">{d.blurb}</span>
                </span>
                <span className="jqzz-snippet-meta">
                  <span className="jqzz-annot">
                    {plural(k.main.steps.length, "phase")} · {seconds(k.main)}s
                  </span>
                  <PhaseStrip shape={k.main} />
                </span>
              </button>
              {k.variants.length > 0 && (
                <div className="jqzz-type-variants" aria-label={`Your other ${d.label} questions`}>
                  <span className="jqzz-annot">or yours:</span>
                  {k.variants.map((v, j) => (
                    <button
                      key={`${v.name}-${j}`}
                      className="jqzz-type-variant"
                      {...dragProps(idOf(v))}
                      onClick={() => onPick(idOf(v))}
                      title={`${plural(v.steps.length, "phase")} · ${seconds(v)}s`}
                    >
                      {v.name.toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
