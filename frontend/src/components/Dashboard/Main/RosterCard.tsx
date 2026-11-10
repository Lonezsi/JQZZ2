import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Quiz } from "../../../types";
import { useQuiz } from "../../../contexts/QuizContext";
import { rosterOf, rosterProblem } from "../../../utils/roster";
import { Keys } from "../../common/Keys";
import { Glyph } from "../../common/Glyph";

/*
 * Who's coming (utils/scriptDocs.ts, WHO'S COMING): a card above the quiz that
 * lists the names people pick from when they join, or, while a quiz has
 * questions and no list, a tip that says it can have one. Dismissing the
 * tip hides it on every quiz: once you know rosters exist, it's said.
 *
 * In visual mode every name is its own textbox. Enter makes a new one, a
 * comma splits a name in two when you leave it, empty ones go. Ctrl Enter
 * saves (Esc and clicking away do too). R, or "who's coming" in the add
 * menu's settings, comes here: the event below.
 */

/** the event R and the settings tray send: open the roster and put the caret in it */
export const ROSTER_EVENT = "jqzz:roster";

const TIP_KEY = "jqzz.rosterTip";
const tipHidden = () => {
  try {
    return localStorage.getItem(TIP_KEY) === "hidden";
  } catch {
    return false; /* no storage: the tip shows, and the ✕ still hides it for now */
  }
};

/** one field's text as names: split on commas, trimmed, inner spaces tidied */
const pieces = (s: string) =>
  s
    .split(",")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);

/** visual mode only: in text mode the Roster line is the list, and R goes to it (ScriptEditor) */
interface RosterCardProps {
  quiz: Quiz;
}

type Draft = { names: string[]; unique: boolean };

export const RosterCard: React.FC<RosterCardProps> = ({ quiz }) => {
  const { setRoster } = useQuiz();
  const found = rosterOf(quiz);
  const roster = found?.roster ?? null;
  const [hidden, setHidden] = useState(tipHidden);
  const [folded, setFolded] = useState(false);
  // while you're in it: the fields as typed, and whether two can share a name
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  // the caret goes into field i at its end, once the render that makes it is done
  const pending = useRef<number | null>(null);
  const justSaved = useRef(false);
  const applyFocus = () => {
    const i = pending.current;
    const f = i === null ? null : fields.current[i];
    if (!f) return;
    pending.current = null;
    f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
  };
  useEffect(applyFocus);
  /** the new fields drawn now, and the caret in one, before the next key can land elsewhere */
  const commit = (d: Draft, focus: number) => {
    flushSync(() => setDraft(d));
    pending.current = focus;
    applyFocus();
  };

  // R and the settings tray: open it, caret in the last name (or a first, empty one)
  useEffect(() => {
    const open = () => {
      const d = draft ?? {
        names: roster?.names.length ? [...roster.names] : [""],
        unique: roster?.unique ?? true,
      };
      flushSync(() => setFolded(false));
      commit(d, d.names.length - 1);
    };
    window.addEventListener(ROSTER_EVENT, open);
    return () => window.removeEventListener(ROSTER_EVENT, open);
  }, [roster, draft]);

  const hideTip = () => {
    setHidden(true);
    try {
      localStorage.setItem(TIP_KEY, "hidden");
    } catch {
      /* fine, it just comes back next time */
    }
  };

  /** the draft as it would be saved; false when it can't be, with why on screen */
  const save = (d: Draft | null = draft): boolean => {
    if (!d) return true;
    const names = d.names.flatMap(pieces);
    if (names.length === 0) {
      if (roster) setRoster(null);
      setDraft(null);
      setProblem(null);
      return true;
    }
    const why = rosterProblem(names);
    if (why) {
      setDraft({ ...d, names });
      setProblem(why);
      return false;
    }
    const same =
      roster &&
      roster.unique === d.unique &&
      roster.names.join("\n") === names.join("\n");
    if (!same) setRoster({ names, unique: d.unique });
    setDraft(null);
    setProblem(null);
    return true;
  };

  const editing =
    draft ?? (roster ? { names: roster.names, unique: roster.unique } : null);
  const start = () =>
    draft ?? {
      names: [...(roster?.names ?? [""])],
      unique: roster?.unique ?? true,
    };
  const change = (i: number, value: string) => {
    const d = start();
    const names = [...d.names];
    names[i] = value;
    setDraft({ ...d, names });
    setProblem(null);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    const d = start();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      // ours, not the page's: Esc mustn't also go back, Ctrl Enter mustn't start the game
      e.preventDefault();
      if (save(d)) {
        // saved: the blur that follows mustn't save the old draft a second time
        justSaved.current = true;
        e.currentTarget.blur();
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // the name you were on splits at its commas, and a new one opens after it
      const here = pieces(d.names[i]);
      const names = [
        ...d.names.slice(0, i),
        ...here,
        "",
        ...d.names.slice(i + 1),
      ];
      commit({ ...d, names }, i + here.length);
      return;
    }
    if (e.key === "Backspace" && d.names[i] === "" && d.names.length > 1) {
      e.preventDefault();
      commit(
        { ...d, names: d.names.filter((_, j) => j !== i) },
        Math.max(0, i - 1),
      );
      return;
    }
    if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      pending.current = i - 1;
      applyFocus();
    } else if (e.key === "ArrowDown" && i < d.names.length - 1) {
      e.preventDefault();
      pending.current = i + 1;
      applyFocus();
    }
  };

  /** leaving a field: "Anna, Bence" becomes two */
  const onFieldBlur = (i: number) => {
    if (!draft || !draft.names[i]?.includes(",")) return;
    const names = [
      ...draft.names.slice(0, i),
      ...pieces(draft.names[i]),
      ...draft.names.slice(i + 1),
    ];
    setDraft({ ...draft, names });
  };

  /** a pasted list, one name a line, fills a field each */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(pasted)) return;
    e.preventDefault();
    const d = start();
    const lines = pasted.split(/\r?\n/).flatMap(pieces);
    const names = [
      ...d.names.slice(0, i),
      ...(d.names[i].trim() ? [d.names[i]] : []),
      ...lines,
      ...d.names.slice(i + 1),
    ];
    commit({ ...d, names }, i + lines.length - (d.names[i].trim() ? 0 : 1));
  };

  // the editor (visual mode, with a list or while making one)
  if (editing) {
    const count = editing.names.filter((n) => n.trim()).length;
    return (
      <div
        className={`jqzz-roster-card${draft ? " editing" : ""}`}
        onBlur={(e) => {
          if (justSaved.current) justSaved.current = false;
          else if (
            draft &&
            !e.currentTarget.contains(e.relatedTarget as Node | null)
          )
            save();
        }}
      >
        <div className="jqzz-roster-head">
          <button
            type="button"
            className="jqzz-roster-fold"
            aria-expanded={!folded}
            onClick={() => setFolded((f) => !f)}
          >
            <span className="jqzz-roster-fold-mark" aria-hidden="true">
              {folded ? "▸" : "▾"}
            </span>
            <span className="jqzz-annot">who's coming · {count}</span>
            {!draft && (
              <span
                className="jqzz-roster-key"
                title="R opens the list from anywhere"
              >
                <Keys combo="R" />
              </span>
            )}
            {folded && (
              <span className="jqzz-roster-summary">
                {editing.names.filter((n) => n.trim()).join(", ")}
              </span>
            )}
          </button>
          {roster && (
            <button
              type="button"
              className="jqzz-roster-link jqzz-roster-trash"
              aria-label="remove the list"
              title="remove the list"
              onClick={() => setRoster(null)}
            >
              <Glyph name="TRASH" size={14} />
            </button>
          )}
        </div>
        {!folded && (
          <>
            <ol className="jqzz-roster-list">
              {editing.names.map((n, i) => (
                <li key={i} className="jqzz-roster-row">
                  <span className="jqzz-roster-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    ref={(el) => {
                      fields.current[i] = el;
                    }}
                    className="jqzz-roster-field"
                    value={n}
                    placeholder="a name"
                    aria-label={`name ${i + 1}`}
                    maxLength={200}
                    onChange={(e) => change(i, e.target.value)}
                    onKeyDown={(e) => onKey(e, i)}
                    onBlur={() => onFieldBlur(i)}
                    onPaste={(e) => onPaste(e, i)}
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="jqzz-roster-link jqzz-roster-add"
              onClick={() => {
                const d = start();
                commit({ ...d, names: [...d.names, ""] }, d.names.length);
              }}
            >
              + a name
            </button>
            {problem && (
              <p className="jqzz-roster-problem" role="alert">
                {problem}
              </p>
            )}
            <label className="jqzz-roster-shared">
              <input
                type="checkbox"
                checked={!editing.unique}
                onChange={(e) => {
                  const unique = !e.target.checked;
                  if (draft) setDraft({ ...draft, unique });
                  else if (roster) setRoster({ ...roster, unique });
                }}
              />
              two people can pick the same name
            </label>
            {draft ? (
              <p className="jqzz-roster-keys">
                <span>
                  <Keys combo="↵" /> new name
                </span>
                <span>
                  <Keys combo="Mod ↵" /> save
                </span>
                <span>
                  <Keys combo="Esc" /> save and leave
                </span>
                <span>commas split a name in two, empty ones go</span>
              </p>
            ) : (
              <p className="jqzz-annot">
                people who join pick their name from this list. it's only used
                in this game, it doesn't change anyone's account.
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  if (!roster) {
    if (hidden || !quiz.actions.some((a) => a.question)) return null;
    return (
      <div className="jqzz-roster-tip">
        <span>
          know who's coming? add their names, and everyone picks theirs when
          they join.
        </span>
        <button
          className="jqzz-roster-link"
          onClick={() => commit({ names: [""], unique: true }, 0)}
        >
          add names <Keys combo="R" />
        </button>
        <button
          className="jqzz-roster-link"
          aria-label="hide this tip"
          title="hide this tip"
          onClick={hideTip}
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
};
