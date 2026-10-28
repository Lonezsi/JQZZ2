import React from "react";
import type { Action, Quiz } from "../../../../types";
import { buildRenderItems } from "../../../../utils/buildRenderItems";
import { describe, parseSettings } from "../../../../utils/settings";
import { typeLabel } from "../../../../utils/questionInfo";
import { Glyph } from "../../../common/Glyph";

/**
 * What a dragged snippet will become, drawn where it would land: the same
 * shapes as the timeline, hollow and shimmering. A whole quiz comes as one
 * bracket around its questions and settings, since that's how it goes in.
 */
export const DropSkeleton: React.FC<{ actions: Action[]; name?: string }> = ({ actions, name }) => {
  const items = buildRenderItems({ actions } as Quiz);
  const groups = items.filter((i) => i.kind === "group").length;
  const whole = groups > 1 || items.length > 2;
  return (
    <div className={`jqzz-drop-skeleton${whole ? " whole" : ""}`} aria-hidden="true">
      {whole && (
        <div className="jqzz-skel-label">
          <Glyph name="QUIZ" size={12} />
          <span>{name || "a quiz"}</span>
          <span className="jqzz-annot">
            {groups} {groups === 1 ? "question" : "questions"} · goes in here
          </span>
        </div>
      )}
      {items.map((item, i) => {
        const style = { "--i": Math.min(i, 10) } as React.CSSProperties;
        if (item.kind === "setting") {
          const chips = describe(parseSettings(item.action.preview), true);
          return (
            <div key={i} className="jqzz-skel-setting" style={style}>
              <Glyph name="SETTING" size={12} />
              <span className="jqzz-annot">from here</span>
              {chips.map((c) => (
                <span key={c} className="jqzz-skel-chip">
                  {c}
                </span>
              ))}
            </div>
          );
        }
        if (item.kind !== "group") {
          return <div key={i} className={`jqzz-skel-line kind-${item.kind}`} style={style} />;
        }
        const q = item.question;
        return (
          <div key={i} className="jqzz-skel-group" style={style}>
            <div className="jqzz-skel-top">
              <span className="jqzz-skel-chip">
                <Glyph name={q.type || "PREWRITTEN_SINGLE"} size={11} />
                {typeLabel(q.type)}
              </span>
            </div>
            <span className="jqzz-skel-text">{q.text?.trim() || "new question"}</span>
            <span className="jqzz-skel-strip">
              {item.actions.map((a) => (
                <span key={a.id} style={{ flexGrow: Math.max(a.time, 1), background: `var(--phase-${a.phase})` }} />
              ))}
            </span>
            {item.actions.map((a) => (
              <span
                key={a.id}
                className="jqzz-skel-step"
                style={{ "--node": `var(--phase-${a.phase})` } as React.CSSProperties}
              >
                <Glyph name={a.phase} size={12} />
                <span>{a.phase.toLowerCase()}</span>
                <span className="jqzz-skel-bar" />
                <b>{a.time}s</b>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};
