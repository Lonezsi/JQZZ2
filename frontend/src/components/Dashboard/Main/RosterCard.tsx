import React, { useState } from "react";
import type { Quiz } from "../../../types";
import { useQuiz } from "../../../contexts/QuizContext";
import { rosterOf, rosterProblem, splitNames } from "../../../utils/roster";

/*
 * Who's coming (docs/script.md, "Who's coming"): a card above the quiz that
 * lists the names people pick from when they join, or, while a quiz has
 * questions and no list, a tip that says it can have one. Dismissing the
 * tip hides it on every quiz: once you know rosters exist, it's said.
 */

const TIP_KEY = "jqzz.rosterTip";
const tipHidden = () => {
  try {
    return localStorage.getItem(TIP_KEY) === "hidden";
  } catch {
    return false; /* no storage: the tip shows, and the ✕ still hides it for now */
  }
};

interface RosterCardProps {
  quiz: Quiz;
  /**
   * Text mode: the card only shows the list (the Roster line is where it's
   * edited), and the tip's "add names" calls this to write that line.
   */
  onAddLine?: () => void;
}

export const RosterCard: React.FC<RosterCardProps> = ({ quiz, onAddLine }) => {
  const { setRoster } = useQuiz();
  const text = !!onAddLine;
  const found = rosterOf(quiz);
  const [hidden, setHidden] = useState(tipHidden);
  // the edit view: the names as typed, one per line, and whether two can share one
  const [draft, setDraft] = useState<{ names: string; unique: boolean } | null>(null);

  const hideTip = () => {
    setHidden(true);
    try {
      localStorage.setItem(TIP_KEY, "hidden");
    } catch {
      /* fine, it just comes back next time */
    }
  };

  if (draft && !text) {
    const names = splitNames(draft.names);
    const problem = rosterProblem(names);
    return (
      <div className="jqzz-roster-card editing">
        <label className="jqzz-field-label" htmlFor="jqzz-roster-names">
          one name per line
        </label>
        <textarea
          id="jqzz-roster-names"
          className="jqzz-field-textarea"
          value={draft.names}
          autoFocus
          onChange={(e) => setDraft({ ...draft, names: e.target.value })}
        />
        {problem && (
          <p className="jqzz-roster-problem" role="alert">
            {problem}
          </p>
        )}
        <label className="jqzz-roster-shared">
          <input
            type="checkbox"
            checked={!draft.unique}
            onChange={(e) => setDraft({ ...draft, unique: !e.target.checked })}
          />
          two people can pick the same name
        </label>
        <div className="jqzz-roster-actions">
          <button
            className="jqzz-ai-btn"
            disabled={!!problem}
            onClick={() => {
              setRoster({ names: names.map((n) => n.replace(/\s+/g, " ")), unique: draft.unique });
              setDraft(null);
            }}
          >
            done
          </button>
          <button className="jqzz-roster-link" onClick={() => setDraft(null)}>
            cancel
          </button>
        </div>
        <p className="jqzz-annot">
          people who join pick their name from this list. it's only used in this game, it doesn't change anyone's
          account.
        </p>
      </div>
    );
  }

  if (!found) {
    if (hidden || !quiz.actions.some((a) => a.question)) return null;
    return (
      <div className="jqzz-roster-tip">
        <span>know who's coming? add their names, and everyone picks theirs when they join.</span>
        <button
          className="jqzz-roster-link"
          onClick={() => (onAddLine ? onAddLine() : setDraft({ names: "", unique: true }))}
        >
          add names
        </button>
        <button className="jqzz-roster-link" aria-label="hide this tip" title="hide this tip" onClick={hideTip}>
          ✕
        </button>
      </div>
    );
  }

  const { roster } = found;
  return (
    <div className="jqzz-roster-card">
      <div className="jqzz-roster-head">
        <span className="jqzz-annot">who's coming · {roster.names.length}</span>
        {!text && (
          <span className="jqzz-roster-actions">
            <button
              className="jqzz-roster-link"
              onClick={() => setDraft({ names: roster.names.join("\n"), unique: roster.unique })}
            >
              edit
            </button>
            <button className="jqzz-roster-link" onClick={() => setRoster(null)}>
              remove the list
            </button>
          </span>
        )}
      </div>
      <div className="jqzz-roster-names">
        {roster.names.map((n) => (
          <span key={n} className="jqzz-roster-chip">
            {n}
          </span>
        ))}
      </div>
      <p className="jqzz-annot">
        people who join pick their name from this list. it's only used in this game, it doesn't change anyone's account.
        {!roster.unique && " two people can pick the same name."}
        {text && " edit it in the Roster line."}
      </p>
    </div>
  );
};
