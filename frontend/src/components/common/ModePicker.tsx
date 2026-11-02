import React from "react";
import { Select } from "./Select";
import { ASKS, askInfo, describe, fixMode, scoreInfo, type Mode } from "../../utils/questionTypes";

/**
 * What a question is, as its two choices (docs/script.md): what players do,
 * and how that scores. The score list only offers what the chosen ask takes.
 */
export const ModePicker: React.FC<{ mode: Mode; onChange: (mode: Mode) => void; id: string; hint?: boolean }> = ({
  mode,
  onChange,
  id,
  hint = true,
}) => {
  const d = describe(mode);
  return (
    <div className="jqzz-mode-picker">
      <div className="jqzz-mode-picker-row">
        <label className="jqzz-field-label" htmlFor={`${id}-ask`}>
          players
        </label>
        <Select
          id={`${id}-ask`}
          value={mode.ask}
          onChange={(v) => onChange(fixMode(v, mode.score))}
          options={ASKS.map((a) => ({ value: a.id, label: a.label, icon: a.icon }))}
        />
      </div>
      <div className="jqzz-mode-picker-row">
        <label className="jqzz-field-label" htmlFor={`${id}-score`}>
          scored by
        </label>
        <Select
          id={`${id}-score`}
          value={mode.score}
          onChange={(v) => onChange(fixMode(mode.ask, v))}
          options={askInfo(mode.ask).scores.map((s) => ({ value: s, label: scoreInfo(s).label, icon: scoreInfo(s).icon }))}
        />
      </div>
      {hint && (
        <p className="jqzz-panel-hint">
          {d.preset ? <b>{d.preset.label}: </b> : null}
          {d.blurb}
        </p>
      )}
    </div>
  );
};
