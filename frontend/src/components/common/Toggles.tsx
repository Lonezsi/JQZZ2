import React from "react";
import { Glyph } from "./Glyph";

export interface ToggleOption {
  key: string;
  label: React.ReactNode;
  icon: string;
  title?: string;
  /** a count or note after the label */
  extra?: React.ReactNode;
}

/**
 * Glide's look, but each segment switches on and off by itself: any number
 * can be on, none included. For filters, where "none" means "all of them".
 */
export const Toggles: React.FC<{
  options: ToggleOption[];
  on: ReadonlySet<string>;
  onToggle: (key: string) => void;
  label: string;
  className?: string;
}> = ({ options, on, onToggle, label, className = "" }) => (
  <div
    className={`jqzz-glide jqzz-toggles ${className}`}
    role="group"
    aria-label={label}
    style={{ "--n": options.length } as React.CSSProperties}
  >
    {options.map((o) => (
      <button key={o.key} type="button" aria-pressed={on.has(o.key)} title={o.title} onClick={() => onToggle(o.key)}>
        <Glyph name={o.icon} size={14} />
        <span className="jqzz-glide-label">{o.label}</span>
        {o.extra}
      </button>
    ))}
  </div>
);
