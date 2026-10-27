import React from "react";
import { Glyph } from "./Glyph";

export interface GlideOption {
  key: string;
  label: React.ReactNode;
  /** a Glyph name: every choice in a switch carries its icon */
  icon: string;
  /** a link, for tabs that are places */
  href?: string;
  title?: string;
  /** a count or note after the label */
  extra?: React.ReactNode;
}

/**
 * Equal segments and one thumb that slides to the chosen one. Tabs that are
 * places pass href; choices pass onPick. Same look either way.
 */
export const Glide: React.FC<{
  options: GlideOption[];
  value: string;
  onPick?: (key: string) => void;
  label: string;
  /** "tabs" for places, "radio" for a choice */
  kind?: "tabs" | "radio";
  className?: string;
  disabled?: boolean;
}> = ({ options, value, onPick, label, kind = "tabs", className = "", disabled }) => {
  const at = Math.max(0, options.findIndex((o) => o.key === value));
  const Tag = kind === "tabs" && options.some((o) => o.href) ? "nav" : "div";
  return (
    <Tag
      className={`jqzz-glide ${className}`}
      role={kind === "radio" ? "radiogroup" : Tag === "nav" ? undefined : "tablist"}
      aria-label={label}
      data-value={value}
      style={{ "--n": options.length, "--at": at } as React.CSSProperties}
    >
      <span className="jqzz-glide-thumb" aria-hidden="true" />
      {options.map((o) => {
        const on = o.key === value;
        const inner = (
          <>
            <Glyph name={o.icon} size={14} />
            <span className="jqzz-glide-label">{o.label}</span>
            {o.extra}
          </>
        );
        if (o.href) {
          return (
            <a key={o.key} href={o.href} aria-current={on ? "page" : undefined} title={o.title}>
              {inner}
            </a>
          );
        }
        return (
          <button
            key={o.key}
            type="button"
            role={kind === "radio" ? "radio" : "tab"}
            aria-checked={kind === "radio" ? on : undefined}
            aria-selected={kind === "tabs" ? on : undefined}
            title={o.title}
            disabled={disabled}
            onClick={() => !on && onPick?.(o.key)}
          >
            {inner}
          </button>
        );
      })}
    </Tag>
  );
};
