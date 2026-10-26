import React from "react";
import { modLabel } from "../../utils/shortcuts";

interface KeysProps {
  combo: string;
  className?: string;
}

/** Keyboard shortcut drawn as little keycaps. Decorative: the control carries aria-keyshortcuts. */
export const Keys: React.FC<KeysProps> = ({ combo, className = "" }) => (
  <span className={`jqzz-keys ${className}`} aria-hidden="true">
    {modLabel(combo)
      .split(" ")
      .map((k, i) => (
        <kbd key={i} className="jqzz-key">
          {k}
        </kbd>
      ))}
  </span>
);
