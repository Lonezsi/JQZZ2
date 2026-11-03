import React from "react";
import { Glyph } from "../common/Glyph";

export type Chip<K extends string> = { key: K; label: string; icon: string; count?: number };

/**
 * A row of filter chips: "all" plus one per option. Picking chips narrows to
 * them (several at once is fine); "all", or letting go of the last one, shows
 * everything again.
 */
export function FilterChips<K extends string>({
  label,
  options,
  on,
  onChange,
  total,
}: {
  label: string;
  options: Chip<K>[];
  on: Set<K>;
  onChange: (next: Set<K>) => void;
  total?: number;
}) {
  const flip = (k: K) => {
    const next = new Set(on);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    // every one picked is the same as all of them
    onChange(next.size === options.length ? new Set() : next);
  };
  return (
    <div className="jqzz-chips" role="group" aria-label={label}>
      <ChipButton pressed={on.size === 0} onClick={() => onChange(new Set())} label="all" count={total} />
      {options.map((o) => (
        <ChipButton
          key={o.key}
          pressed={on.has(o.key)}
          onClick={() => flip(o.key)}
          label={o.label}
          icon={o.icon}
          count={o.count}
        />
      ))}
    </div>
  );
}

const ChipButton: React.FC<{
  pressed: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
  count?: number;
}> = ({ pressed, onClick, label, icon, count }) => (
  <button type="button" className="jqzz-chip" aria-pressed={pressed} onClick={onClick}>
    {icon && <Glyph name={icon} size={13} />}
    <span>{label}</span>
    {count != null && <span className="jqzz-chip-count">{count}</span>}
  </button>
);
