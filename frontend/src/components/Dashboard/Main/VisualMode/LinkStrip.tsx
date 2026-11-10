import React from "react";
import type { Action, Question } from "../../../../types";
import { useQuiz } from "../../../../contexts/QuizContext";
import {
  OVERFLOW_DEFAULT,
  PICKS_MOST,
  formatOptions,
  modeOf,
  overflowOf,
  parseOptions,
} from "../../../../utils/questionTypes";
import type {
  LinkField,
  Mode,
  QuestionOptions,
} from "../../../../utils/questionTypes";
import {
  linkTo,
  plainRefs,
  showRefs,
  sourceOf,
  sourcesFor,
} from "../../../../utils/scriptRefs";

/*
 * On the question step's card: what it takes from an earlier question, how
 * many each player votes for, and whether each gets their own set (overflow).
 * The same three things the inspector's LinkFields sets, right where the
 * question is, so a vote on answers can be put together without opening it.
 */

const OWN_SET_MOST = 20;
const makes = (m: Mode) => m.ask === "write" || m.ask === "draw";

/** what the source reads as on the card; null when this kind takes from nothing */
function linkWord(m: Mode): string | null {
  if (m.ask === "pick") return "options from";
  if (makes(m) && m.score !== "secret") return "hands out answers to";
  if (m.ask === "person" && m.score === "right")
    return "who made the winner of";
  return null;
}

/** keeps a press inside the strip from selecting the card under it */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const Stepper: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}> = ({ label, value, min, max, onChange }) => (
  <span className="jqzz-link-chip">
    <span>{label}</span>
    <button
      type="button"
      className="jqzz-link-step"
      aria-label={`${label}: fewer`}
      disabled={value <= min}
      onClick={() => onChange(value - 1)}
    >
      −
    </button>
    <span className="jqzz-link-num" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      className="jqzz-link-step"
      aria-label={`${label}: more`}
      disabled={value >= max}
      onClick={() => onChange(value + 1)}
    >
      +
    </button>
  </span>
);

export const LinkStrip: React.FC<{ question: Question; actions: Action[] }> = ({
  question,
  actions,
}) => {
  const { updateQuestion } = useQuiz();
  const mode = modeOf(question);
  const options = parseOptions(question.options);
  const word = linkWord(mode);
  const voting =
    (mode.ask === "pick" && !!options.from) || mode.score === "votes";
  const ownSet = mode.ask === "pick" && !!options.from;
  if (!word && !voting) return null;

  // on a card, only for what needs a link or has one: a plain pick or write that could
  // take from something keeps its card plain (the inspector still offers it)
  const needs =
    (mode.ask === "pick" && mode.score === "votes") ||
    (mode.ask === "person" && mode.score === "right");
  if (!needs && !options.from) return null;
  const source = sourceOf(actions, question);
  const candidates = word ? sourcesFor(actions, question) : [];

  const setLink = (patch: Partial<Record<LinkField, string | undefined>>) => {
    const next: QuestionOptions = { ...options, ...patch };
    (Object.keys(patch) as LinkField[]).forEach((k) => {
      if (patch[k] === undefined) delete next[k];
    });
    updateQuestion(question.id, { options: formatOptions(next) || undefined });
  };
  const picks = Math.max(1, Number(options.picks) || 1);
  const overflow = overflowOf(options);

  return (
    <span
      className="jqzz-link-strip"
      onClick={stop}
      onMouseDown={stop}
      onKeyDown={stop}
      onDoubleClick={stop}
    >
      {word && (
        <label
          className={`jqzz-link-chip${options.from && !source ? " warn" : !options.from ? " empty" : ""}`}
        >
          <span>{word}</span>
          <select
            value={source ? String(source.id) : options.from ? "gone" : ""}
            onChange={(e) => {
              const picked =
                candidates.find((c) => String(c.question.id) === e.target.value)
                  ?.question ?? null;
              linkTo(actions, question, picked).forEach(({ id, patch }) =>
                updateQuestion(id, patch),
              );
            }}
          >
            {options.from && !source && (
              <option value="gone">a question that's gone</option>
            )}
            <option value="">
              {candidates.length ? "pick one" : "nothing earlier yet"}
            </option>
            {candidates.map((c) => (
              <option key={c.question.id} value={String(c.question.id)}>
                Q{c.n} ·{" "}
                {plainRefs(
                  showRefs(c.question.text, actions, c.question),
                ).slice(0, 32) || "untitled"}
              </option>
            ))}
          </select>
        </label>
      )}
      {voting && (
        <Stepper
          label="votes each"
          value={picks}
          min={1}
          max={PICKS_MOST}
          // 1 is the default, so it isn't kept
          onChange={(n) => setLink({ picks: n > 1 ? String(n) : undefined })}
        />
      )}
      {ownSet && (
        <>
          <label className={`jqzz-link-chip${overflow ? "" : " empty"}`}>
            <input
              type="checkbox"
              checked={overflow > 0}
              onChange={(e) =>
                setLink({
                  overflow: e.target.checked
                    ? String(OVERFLOW_DEFAULT)
                    : undefined,
                })
              }
            />
            <span>own sets</span>
          </label>
          {overflow > 0 && (
            <Stepper
              label="at most"
              value={overflow}
              min={2}
              max={OWN_SET_MOST}
              onChange={(n) => setLink({ overflow: String(n) })}
            />
          )}
        </>
      )}
    </span>
  );
};
