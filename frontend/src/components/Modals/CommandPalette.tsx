import React, { useState, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { COMMANDS } from "../../constants/commands";

interface CommandPaletteProps {
  onClose: () => void;
  onExecute: (label: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onClose, onExecute }) => {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = COMMANDS.filter(
    (c) => !query || c.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0);
  }, [query]);

  const execute = (label: string) => {
    onExecute(label);
    onClose();
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && filtered[activeIdx]) {
      execute(filtered[activeIdx].label);
    }
  };

  return (
    <div className="jqzz-palette-overlay" onClick={onClose}>
      <div
        className="jqzz-palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="jqzz-palette-input-wrap">
          <span style={{ color: "var(--txt3)" }}>{">"}</span>
          <input
            ref={inputRef}
            className="jqzz-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="jqzz-cmd-list">
          {filtered.map((cmd, i) => (
            <div
              key={cmd.label}
              className={`jqzz-cmd-item${i === activeIdx ? " active" : ""}`}
              onClick={() => execute(cmd.label)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="jqzz-cmd-icon">{cmd.icon}</span>
              <span className="jqzz-cmd-label">{cmd.label}</span>
              {cmd.sub && <span className="jqzz-cmd-sub">{cmd.sub}</span>}
            </div>
          ))}
        </div>
        <div className="jqzz-palette-footer">
          {[
            ["Enter", "select"],
            ["Esc", "close"],
            ["↑↓", "navigate"],
          ].map(([k, v]) => (
            <div key={k} className="jqzz-palette-hint">
              <span className="jqzz-kbd">{k}</span> {v}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
