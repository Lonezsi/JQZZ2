import React, { useState, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { Quiz } from "../../types";
import { COMMANDS } from "../../constants/commands";
import { usePresence } from "../../hooks/usePresence";
import { Keys } from "../common/Keys";
import { matchQuiz } from "../../utils/quizSearch";
import { quizCode } from "../../utils/timecode";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (label: string) => void;
  quizzes: Quiz[];
  onOpenQuiz: (id: number) => void;
}

type Item =
  | { kind: "command"; key: string; icon: string; label: string; sub: string }
  | { kind: "quiz"; key: string; icon: string; label: string; sub: string; id: number; via?: string };

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onExecute,
  quizzes,
  onOpenQuiz,
}) => {
  const { mounted, state } = usePresence(open, 220);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // fresh every time it opens
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setActiveIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // the arrow keys move the highlight past the edge of the list: bring it into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>(".jqzz-cmd-item");
    if (!rows || rows.length === 0) return;
    rows[Math.min(activeIdx, rows.length - 1)].scrollIntoView({ block: "nearest" });
  }, [activeIdx, query, mounted]);

  if (!mounted) return null;

  const q = query.toLowerCase();
  const items: Item[] = [
    ...COMMANDS.filter((c) => !q || c.label.toLowerCase().includes(q)).map(
      (c): Item => ({ kind: "command", key: c.label, ...c }),
    ),
    // quizzes only show up once you type, so the list stays short
    ...(q
      ? quizzes
          .map((quiz) => ({ quiz, m: matchQuiz(quiz, query) }))
          .filter((r) => r.m.hit)
          .slice(0, 6)
          .map(
            ({ quiz, m }): Item => ({
              kind: "quiz",
              key: `quiz-${quiz.id}`,
              icon: "↗",
              label: quiz.name,
              sub: quizCode(quiz.id),
              id: quiz.id,
              via: m.via,
            }),
          )
      : []),
  ];
  const active = Math.min(activeIdx, Math.max(items.length - 1, 0));
  const firstQuiz = items.findIndex((i) => i.kind === "quiz");

  const execute = (item: Item) => {
    onClose();
    if (item.kind === "quiz") onOpenQuiz(item.id);
    else onExecute(item.label);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      execute(items[active]);
    }
  };

  return (
    <div className="jqzz-palette-overlay" data-state={state} onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      <div
        className="jqzz-palette jqzz-holo"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="jqzz-holo-dots" aria-hidden="true" />
        <div className="jqzz-holo-dust" aria-hidden="true" />
        <div className="jqzz-palette-input-wrap">
          <span className="jqzz-star jqzz-palette-star" aria-hidden="true" />
          <input
            ref={inputRef}
            className="jqzz-palette-input"
            placeholder="type a command or a quiz name"
            aria-label="Command or quiz"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
          />
          <span className="jqzz-annot">{items.length} results</span>
        </div>
        <div
          ref={listRef}
          className="jqzz-cmd-list"
          role="listbox"
          aria-label="Results"
          style={
            {
              "--active": active,
              // the quiz section has a 30px label above it
              "--offset": firstQuiz >= 0 && active >= firstQuiz ? "30px" : "0px",
            } as React.CSSProperties
          }
        >
          {items.length > 0 && <span className="jqzz-cmd-lens" aria-hidden="true" />}
          {items.map((item, i) => (
            <React.Fragment key={item.key}>
              {i === firstQuiz && <div className="jqzz-cmd-section jqzz-annot">quizzes</div>}
              <div
                role="option"
                aria-selected={i === active}
                className={`jqzz-cmd-item${i === active ? " active" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                onClick={() => execute(item)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="jqzz-cmd-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="jqzz-cmd-label">
                  {item.label}
                  {item.kind === "quiz" && item.via && (
                    <span className="jqzz-cmd-via">“{item.via}”</span>
                  )}
                </span>
                {item.kind === "command" ? (
                  item.sub && <Keys combo={item.sub} />
                ) : (
                  <span className="jqzz-cmd-sub">{item.sub}</span>
                )}
              </div>
            </React.Fragment>
          ))}
          {items.length === 0 && (
            <p className="jqzz-cmd-empty">no command or quiz like that.</p>
          )}
        </div>
        <div className="jqzz-palette-footer">
          {[
            ["↵", "run"],
            ["↑ ↓", "move"],
            ["Esc", "close"],
          ].map(([k, v]) => (
            <div key={k} className="jqzz-palette-hint">
              <Keys combo={k} /> {v}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
