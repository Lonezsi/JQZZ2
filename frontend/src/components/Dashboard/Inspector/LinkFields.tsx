import React, { useState } from "react";
import type { Action, Question } from "../../../types";
import { Select } from "../../common/Select";
import {
  OVERFLOW_DEFAULT,
  PICKS_MOST,
  borrows,
  formatOptions,
  overflowOf,
  parseOptions,
} from "../../../utils/questionTypes";
import type { LinkField, Mode, QuestionOptions } from "../../../utils/questionTypes";
import { linkTo, plainRefs, showRefs, sourceOf, sourcesFor } from "../../../utils/scriptRefs";

/*
 * Using an earlier question (docs/script.md): which one a question takes its
 * answers from, how many each player votes for, and whether each gets their
 * own set. The script says from: "Q1"; the quiz keeps a hidden label, so
 * these fields go through scriptRefs and never write a label by hand.
 */

type Patches = { id: number; patch: Partial<Question> }[];

const makes = (m: Mode) => m.ask === "write" || m.ask === "draw";

/** what the source picker says for this kind of question; null when it takes from nothing */
function sourceLabel(m: Mode): string | null {
  if (m.ask === "pick") return "options are the answers to";
  if (makes(m) && m.score !== "secret") return "each player gets someone's answer to";
  if (m.ask === "person" && m.score === "right") return "the right answer is whoever made the winner of";
  return null;
}

/**
 * A number typed in a field that stores something else when it's out of
 * range (nothing at all, for the default). What's typed stays on screen, so
 * "1" on the way to "10" doesn't vanish under the cursor.
 */
const NumberField: React.FC<{
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  placeholder?: string;
  onCommit: (raw: string) => void;
}> = ({ id, label, value, min, max, placeholder, onCommit }) => {
  const [draft, setDraft] = useState(value);
  return (
    <div className="jqzz-field-group">
      <label className="jqzz-field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="jqzz-field-input"
        type="number"
        min={min}
        max={max}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onCommit(e.target.value);
        }}
      />
    </div>
  );
};

interface LinkFieldsProps {
  question: Question;
  actions: Action[];
  mode: Mode;
  apply: (patches: Patches) => void;
}

/** the source picker, votes each and their own set; after the extras in the inspector */
export const LinkFields: React.FC<LinkFieldsProps> = ({ question, actions, mode, apply }) => {
  const options = parseOptions(question.options);
  const label = sourceLabel(mode);
  const source = sourceOf(actions, question);
  const dangling = !!options.from && !source;
  const candidates = label ? sourcesFor(actions, question) : [];
  const voting = (mode.ask === "pick" && !!options.from) || mode.score === "votes";
  const ownSet = mode.ask === "pick" && !!options.from;
  if (!label && !voting) return null;

  const setLink = (patch: Partial<Record<LinkField, string | undefined>>) => {
    const next: QuestionOptions = { ...options, ...patch };
    (Object.keys(patch) as LinkField[]).forEach((k) => {
      if (patch[k] === undefined) delete next[k];
    });
    apply([{ id: question.id, patch: { options: formatOptions(next) || undefined } }]);
  };

  const person = mode.ask === "person";
  const overflow = overflowOf(options);

  return (
    <div className="jqzz-link-field">
      {label &&
        (candidates.length === 0 && !options.from ? (
          <p className="jqzz-panel-hint">
            {person
              ? "no earlier vote to use yet. add a question people vote on before this one."
              : "no earlier question to use yet. add a write or draw question before this one."}
          </p>
        ) : (
          <div className="jqzz-field-group">
            <label className="jqzz-field-label" htmlFor="jqzz-link-source">
              {label}
            </label>
            <Select
              id="jqzz-link-source"
              placeholder="pick a question"
              value={source ? String(source.id) : dangling ? "gone" : ""}
              onChange={(v) => {
                const picked = candidates.find((c) => String(c.question.id) === v)?.question ?? null;
                apply(linkTo(actions, question, picked));
              }}
              options={[
                { value: "", label: "nothing" },
                ...candidates.map((c) => ({
                  value: String(c.question.id),
                  label: `Q${c.n} · ${plainRefs(showRefs(c.question.text, actions, c.question)).slice(0, 40) || "untitled"}`,
                })),
              ]}
            />
          </div>
        ))}

      {dangling && <p className="jqzz-panel-hint jqzz-link-warn">the question this used is gone</p>}
      {!options.from && borrows(mode, options) && (
        <p className="jqzz-panel-hint jqzz-link-warn">choose the question whose answers are the options</p>
      )}
      {!options.from && person && mode.score === "right" && (
        <p className="jqzz-panel-hint jqzz-link-warn">choose whose winner this is about</p>
      )}

      {voting && (
        <>
          <NumberField
            id="jqzz-link-picks"
            label="votes each"
            value={options.picks ?? ""}
            min={1}
            max={PICKS_MOST}
            placeholder="1"
            onCommit={(raw) => {
              const n = Math.round(Number(raw));
              // 1 is the default, so it isn't kept
              setLink({ picks: raw.trim() && Number.isFinite(n) && n > 1 ? String(Math.min(PICKS_MOST, n)) : undefined });
            }}
          />
          <p className="jqzz-panel-hint">how many different ones each player can vote for.</p>
        </>
      )}

      {ownSet && (
        <>
          <label className="jqzz-link-check">
            <input
              type="checkbox"
              checked={overflow > 0}
              onChange={(e) => setLink({ overflow: e.target.checked ? String(OVERFLOW_DEFAULT) : undefined })}
            />
            each player gets their own set
          </label>
          {overflow > 0 && (
            <NumberField
              id="jqzz-link-overflow"
              label="at most"
              value={String(overflow)}
              min={2}
              max={20}
              onCommit={(raw) => {
                const n = Math.round(Number(raw));
                // a half-typed number keeps the last good one
                if (raw.trim() && Number.isFinite(n) && n >= 2) setLink({ overflow: String(Math.min(20, n)) });
              }}
            />
          )}
          <p className="jqzz-panel-hint">every answer still gets seen. the big screen won't show the options.</p>
        </>
      )}
    </div>
  );
};

/** a fill-in in stored text: {@q2.winner}, {author} or {answer} */
const FILL_IN = /\{@[a-z0-9-]+\.winner\}|\{author\}|\{answer\}/i;

/** under the prompt: which fill-ins this question can use, and how the prompt reads to players */
export const FillInHelp: React.FC<{ question: Question; actions: Action[]; mode: Mode; text: string }> = ({
  question,
  actions,
  mode,
  text,
}) => {
  // questions with a winner it can name: the same ones a "who made the winner"
  // question could take from, so ask as one
  const winners = sourcesFor(actions, { ...question, mode: "person/right" });
  const nearest = winners[winners.length - 1];
  const dealt = makes(mode) && !!sourceOf(actions, question);
  const filled = FILL_IN.test(text);
  if (!nearest && !dealt && !filled) return null;
  return (
    <p className="jqzz-panel-hint jqzz-fillins">
      {(nearest || dealt) && "fill-ins: "}
      {nearest && `{Q${nearest.n}.winner} puts in Q${nearest.n}'s winning answer. `}
      {dealt && "{author} and {answer} become someone else's name and answer, different on every phone."}
      {filled && (
        <>
          {(nearest || dealt) && <br />}
          players see: {plainRefs(text)}
        </>
      )}
    </p>
  );
};
