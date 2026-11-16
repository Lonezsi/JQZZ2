import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import type { Action, Question, Answer, Phase } from "../../../types";
import { generateId } from "../../../utils/idGenerator";
import { ImagePicker } from "../../Modals/ImagePicker";
import { borrows, describe, formatOptions, modeKey, modeOf, parseOptions, typeIdOf } from "../../../utils/questionTypes";
import type { Mode, QuestionField } from "../../../utils/questionTypes";
import { ModePicker } from "../../common/ModePicker";
import { Select } from "../../common/Select";
import { SETTING_LABEL, formatSettings, parseSettings } from "../../../utils/settings";
import type { QuizSettings } from "../../../utils/settings";
import { useAuth } from "../../../contexts/AuthContext";
import { useQuiz } from "../../../contexts/QuizContext";
import { DRAG_IMAGE_KEY, dragging } from "../../../utils/dragKeys";
import { QuestionImage } from "../../Play/PlayCommon";
import { Glyph } from "../../common/Glyph";
import { Glide } from "../../common/Glide";
import { showRefs, storeRefs } from "../../../utils/scriptRefs";
import { FillInHelp, LinkFields } from "./LinkFields";
import { Keys } from "../../common/Keys";
import { pastedLines, useListFocus } from "../../../hooks/useListFocus";

interface ContextEditorProps {
  action: Action | null;
  question: Question | null;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
}

const PHASES = ["WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"] as const;

const FIELD_LABEL: Record<QuestionField, string> = { unit: "unit", min: "slider from", max: "slider to", rounds: "turns" };
const FIELD_HINT: Record<QuestionField, string> = { unit: "m, kg, years", min: "none", max: "none", rounds: "one per player" };

/** An answer's picture: drop one from the stash on it; a click takes it off again. */
const AnswerPictureSlot: React.FC<{ src?: string; index: number; onChange: (ref: string) => void }> = ({
  src,
  index,
  onChange,
}) => {
  const { user } = useAuth();
  const { quiz } = useQuiz();
  const [over, setOver] = useState(false);
  const viewer = user?.id ?? "";
  return (
    <button
      type="button"
      className={`jqzz-answer-pic${src ? " filled" : ""}${over ? " over" : ""}`}
      aria-label={src ? `Remove the picture from answer ${index + 1}` : `Answer ${index + 1} has no picture`}
      title={src ? "take the picture off" : "drag a picture from your stash here"}
      onClick={() => src && onChange("")}
      onDragOver={(e) => {
        if (!dragging(e, DRAG_IMAGE_KEY)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const ref = e.dataTransfer.getData(DRAG_IMAGE_KEY);
        setOver(false);
        if (!ref) return;
        e.preventDefault();
        onChange(ref);
      }}
    >
      {src ? (
        <>
          <QuestionImage src={src} ownerId={quiz?.authorId ?? viewer} viewerId={viewer} className="jqzz-answer-pic-img" />
          <span className="jqzz-answer-pic-off" aria-hidden="true">
            ✕
          </span>
        </>
      ) : (
        <Glyph name="IMAGE" size={12} />
      )}
    </button>
  );
};

export const ContextEditor: React.FC<ContextEditorProps> = ({
  action,
  question,
  onActionUpdate,
  onQuestionUpdate,
}) => {
  const [answers, setAnswers] = useState<Answer[]>(question?.answers ?? []);
  const answerList = useListFocus();
  const { quiz } = useQuiz();
  const actions = quiz?.actions ?? [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(question?.answers ?? []);
  }, [question?.id, question?.answers]);

  if (!action) {
    return <p className="jqzz-panel-hint">click a card to edit it.</p>;
  }

  if (action.phase === "ROSTER") {
    // not on the timeline, so never selected; just in case, it says where it's edited
    return <p className="jqzz-panel-hint">who's coming is edited on its card above the timeline.</p>;
  }

  if (action.phase === "DIVIDER") {
    return (
      <p className="jqzz-panel-hint">
        a line that splits the quiz into sections. it's skipped when the quiz runs.
      </p>
    );
  }

  if (action.phase === "SETTING") {
    const s = parseSettings(action.preview);
    const set = (patch: Partial<QuizSettings>) => {
      const next = { ...s, ...patch };
      (Object.keys(patch) as (keyof QuizSettings)[]).forEach((k) => {
        if (patch[k] === undefined) delete next[k];
      });
      onActionUpdate(action.id, { preview: formatSettings(next) });
    };
    const flags: ("shuffle" | "mix" | "grade" | "latejoin" | "speed")[] = ["shuffle", "mix", "grade", "latejoin", "speed"];
    return (
      <>
        <div className="jqzz-section-label">settings from here on</div>
        {flags.map((k) => (
          <div key={k} className="jqzz-field-group">
            <span className="jqzz-field-label">{SETTING_LABEL[k]}</span>
            {/* three fixed choices: a switch, not a menu */}
            <Glide
              kind="radio"
              className="jqzz-glide-fill"
              label={SETTING_LABEL[k]}
              value={s[k] === undefined ? "keep" : s[k] ? "on" : "off"}
              onPick={(v) => set({ [k]: v === "keep" ? undefined : v === "on" })}
              options={[
                { key: "keep", label: "keep", icon: "RESET", title: "keep as it was" },
                { key: "on", label: "on", icon: "CHECK" },
                { key: "off", label: "off", icon: "CLOSE" },
              ]}
            />
          </div>
        ))}
        <div className="jqzz-field-group">
          <span className="jqzz-field-label">{SETTING_LABEL.points}</span>
          <Glide
            kind="radio"
            className="jqzz-glide-fill jqzz-glide-points"
            label={SETTING_LABEL.points}
            value={s.points === undefined ? "keep" : [1, 2, 3].includes(s.points) ? String(s.points) : "other"}
            onPick={(v) =>
              set({ points: v === "keep" ? undefined : v === "other" ? 5 : Number(v) })
            }
            options={[
              { key: "keep", label: "keep", icon: "RESET", title: "keep as it was" },
              ...[1, 2, 3].map((n) => ({ key: String(n), label: `×${n}`, icon: "STAR", title: `points ×${n}` })),
              { key: "other", label: "other", icon: "SETTING", title: "any amount from 0 to 10" },
            ]}
          />
          {/* the script takes 0 to 10 in halves: anything the three buttons don't cover goes here */}
          {s.points !== undefined && ![1, 2, 3].includes(s.points) && (
            <input
              className="jqzz-field-input jqzz-points-other"
              type="number"
              min={0}
              max={10}
              step={0.5}
              aria-label="points multiplier, 0 to 10"
              defaultValue={s.points}
              key={action.id}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (e.target.value.trim() && Number.isFinite(n)) set({ points: Math.max(0, Math.min(10, n)) });
              }}
            />
          )}
        </div>
        <p className="jqzz-panel-hint">
          these hold for every question after this block, until another block changes them. in text
          mode it's a group: <code>shuffle {"{"}</code> ... <code>{"}"}</code>
        </p>
      </>
    );
  }

  if (action.phase === "TEXT") {
    return (
      <>
        <div className="jqzz-section-label">note</div>
        <div className="jqzz-field-group">
          <label className="jqzz-field-label" htmlFor="jqzz-note">
            text
          </label>
          <textarea
            id="jqzz-note"
            className="jqzz-field-textarea"
            value={action.preview}
            onChange={(e) => onActionUpdate(action.id, { preview: e.target.value })}
          />
        </div>
        <p className="jqzz-panel-hint">notes are for you. they're skipped when the quiz runs.</p>
      </>
    );
  }

  const updateAnswer = (idx: number, field: keyof Answer, val: string) => {
    const next = answers.map((a, i) =>
      i === idx ? { ...a, [field]: field === "value" ? Number(val) : val } : a,
    );
    setAnswers(next);
    if (question) onQuestionUpdate(question.id, { answers: next });
  };

  const mode = modeOf(question);
  const info = describe(mode);
  const shape = info.answers;
  const setMode = (next: Mode) => {
    if (!question) return;
    // a pair needs its other half, even an empty one, for its column to show
    const nextShape = describe(next).answers;
    const fixed = nextShape?.match ? answers.map((a) => ({ ...a, match: a.match ?? "" })) : answers;
    if (fixed !== answers) setAnswers(fixed);
    onQuestionUpdate(question.id, { mode: modeKey(next), type: typeIdOf(next), ...(fixed !== answers ? { answers: fixed } : {}) });
  };

  const options = parseOptions(question?.options);
  const setOption = (key: QuestionField, value: string) => {
    if (!question) return;
    onQuestionUpdate(question.id, { options: formatOptions({ ...options, [key]: value.trim() }) || undefined });
  };

  /** patches for several questions at once: a link labels its source too */
  const apply = (patches: { id: number; patch: Partial<Question> }[]) =>
    patches.forEach(({ id, patch }) => onQuestionUpdate(id, patch));

  // prompts keep {@q2.winner}; here they read and are typed as {Q2.winner}
  const shownText = question ? showRefs(question.text, actions, question) : "";
  const shownElab = question ? showRefs(question.elaborationText ?? "", actions, question) : "";
  const textError = question ? storeRefs(shownText, actions, question).error : undefined;
  const elabError = question ? storeRefs(shownElab, actions, question).error : undefined;
  const setText = (field: "text" | "elaborationText", typed: string) => {
    if (!question) return;
    const stored = storeRefs(typed, actions, question);
    apply(stored.patches);
    onQuestionUpdate(question.id, { [field]: stored.text });
  };

  // a question whose options or list of players come from elsewhere
  const noAnswers =
    mode.ask === "person"
      ? "no answers here: the options are the players."
      : borrows(mode, options)
        ? "no answers here: the options are that question's answers."
        : null;

  const removeAnswer = (idx: number) => {
    const next = answers.filter((_, i) => i !== idx);
    setAnswers(next);
    if (question) onQuestionUpdate(question.id, { answers: next });
  };

  // the answers edit like the roster (hooks/useListFocus.ts): Enter adds the next,
  // Backspace in an empty one takes it out, a pasted list fills a row a line, and
  // Alt ↑ ↓ moves one. No comma split here: answers can hold commas.
  const canAddAnswer = !!shape && !noAnswers && !(mode.ask === "number" && answers.length >= 1);
  const blankAnswer = (text = ""): Answer => ({
    id: generateId(),
    text,
    value: shape?.starts ?? 0,
    ...(shape?.match ? { match: "" } : {}),
  });
  const commitAnswers = (next: Answer[], focus?: number) => {
    flushSync(() => setAnswers(next));
    if (question) onQuestionUpdate(question.id, { answers: next });
    if (focus !== undefined) answerList.focusAt(focus);
  };
  const moveAnswer = (i: number, by: -1 | 1) => {
    const to = i + by;
    if (to < 0 || to >= answers.length) return;
    const next = [...answers];
    [next[i], next[to]] = [next[to], next[i]];
    commitAnswers(next, to);
  };
  const onAnswerKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (!canAddAnswer) return;
      e.preventDefault();
      commitAnswers([...answers.slice(0, i + 1), blankAnswer(), ...answers.slice(i + 1)], i + 1);
    } else if (e.key === "Backspace" && !answers[i].text && !answers[i].match && answers.length > 1) {
      e.preventDefault();
      commitAnswers(
        answers.filter((_, j) => j !== i),
        Math.max(0, i - 1),
      );
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.altKey) {
      e.preventDefault();
      moveAnswer(i, e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      answerList.focusAt(i - 1);
    } else if (e.key === "ArrowDown" && i < answers.length - 1) {
      e.preventDefault();
      answerList.focusAt(i + 1);
    }
  };
  const onAnswerPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    const lines = pastedLines(e);
    if (!lines || !canAddAnswer || mode.ask === "number") return;
    e.preventDefault();
    // into this row if it's empty, the rest after it
    const here = answers[i].text.trim() ? [] : [lines.shift()!];
    const rows = [
      ...answers.slice(0, i),
      here.length ? { ...answers[i], text: here[0] } : answers[i],
      ...lines.map((l) => blankAnswer(l)),
      ...answers.slice(i + 1),
    ];
    commitAnswers(rows, i + lines.length);
  };

  return (
    <>
      <div className="jqzz-section-label">phase</div>
      <div className="jqzz-field-pair">
        <div className="jqzz-field-group">
          <label className="jqzz-field-label" htmlFor="jqzz-phase">
            type
          </label>
          <Select
            id="jqzz-phase"
            value={action.phase}
            onChange={(v) => onActionUpdate(action.id, { phase: v as Phase })}
            options={PHASES.map((p) => ({ value: p, label: p.toLowerCase(), icon: p }))}
          />
        </div>
        <div className="jqzz-field-group">
          <label className="jqzz-field-label" htmlFor="jqzz-time">
            seconds
          </label>
          <input
            id="jqzz-time"
            className="jqzz-field-input"
            type="number"
            min={0}
            value={action.time}
            onChange={(e) => onActionUpdate(action.id, { time: Number(e.target.value) })}
          />
        </div>
      </div>

      {question && (
        <>
          <div className="jqzz-section-label">question</div>
          <div className="jqzz-field-group">
            <ModePicker id="jqzz-qmode" mode={mode} onChange={setMode} />
          </div>
          <div className="jqzz-field-group">
            <label className="jqzz-field-label" htmlFor="jqzz-prompt">
              prompt
            </label>
            <textarea
              id="jqzz-prompt"
              className="jqzz-field-textarea"
              value={shownText}
              onChange={(e) => setText("text", e.target.value)}
            />
            {textError && (
              <p className="jqzz-panel-hint jqzz-link-warn" role="alert">
                {textError}
              </p>
            )}
            <FillInHelp question={question} actions={actions} mode={mode} text={question.text} />
          </div>
          <div className="jqzz-field-group">
            <div className="jqzz-field-label">image</div>
            <ImagePicker
              value={question.imageUrl || ""}
              onChange={(url) => onQuestionUpdate(question.id, { imageUrl: url })}
            />
          </div>
          <div className="jqzz-field-group">
            <label className="jqzz-field-label" htmlFor="jqzz-elab">
              elaboration
            </label>
            <textarea
              id="jqzz-elab"
              className="jqzz-field-textarea short"
              placeholder="shown after the answer"
              value={shownElab}
              onChange={(e) => setText("elaborationText", e.target.value)}
            />
            {elabError && (
              <p className="jqzz-panel-hint jqzz-link-warn" role="alert">
                {elabError}
              </p>
            )}
          </div>
          {info.fields.length > 0 && (
            <div className="jqzz-field-pair">
              {info.fields.map((f) => (
                <div key={f} className="jqzz-field-group">
                  <label className="jqzz-field-label" htmlFor={`jqzz-opt-${f}`}>
                    {FIELD_LABEL[f]}
                  </label>
                  <input
                    id={`jqzz-opt-${f}`}
                    className="jqzz-field-input"
                    type={f === "unit" ? "text" : "number"}
                    placeholder={FIELD_HINT[f]}
                    value={options[f] ?? ""}
                    onChange={(e) => setOption(f, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
          <LinkFields question={question} actions={actions} mode={mode} apply={apply} />
          {(shape || answers.length > 0 || noAnswers) && (
            <>
              <div className="jqzz-section-label">
                {shape ? `${shape.text}s` : "answers"} <span className="jqzz-section-count">{answers.length}</span>
              </div>
              {noAnswers ? (
                <p className="jqzz-panel-hint">{noAnswers}</p>
              ) : (
                !shape && <p className="jqzz-panel-hint">no answers here: players make them.</p>
              )}
              {mode.ask === "order" && <p className="jqzz-panel-hint">put them in the right order here, players see them shuffled. alt ↑ ↓ moves one.</p>}
              {mode.ask === "number" && <p className="jqzz-panel-hint">one answer: the right number, and the points for getting it spot on.</p>}
              {mode.score === "secret" && <p className="jqzz-panel-hint">everyone gets one of these to {mode.ask === "draw" ? "draw" : "describe without saying it"}.</p>}
              {answers.length > 0 && (
                <div className={`jqzz-answer-head${shape?.match ? " pairs" : ""}${shape && !shape.value ? " plain" : ""}`} aria-hidden="true">
                  <span />
                  <span>{shape?.text ?? "answer"}</span>
                  {shape?.match && <span>{shape.match}</span>}
                  {(!shape || shape.value) && <span title={shape?.value ?? undefined}>points</span>}
                </div>
              )}
              {answers.map((a, i) => (
                <div key={a.id} className={`jqzz-answer-row${shape?.match ? " pairs" : ""}${shape && !shape.value ? " plain" : ""}`}>
                  <AnswerPictureSlot src={a.imageUrl} index={i} onChange={(ref) => updateAnswer(i, "imageUrl", ref)} />
                  <input
                    ref={answerList.ref(i)}
                    className="jqzz-answer-text"
                    value={a.text}
                    placeholder={shape?.text ?? "answer"}
                    inputMode={mode.ask === "number" ? "decimal" : undefined}
                    aria-label={`${shape?.text ?? "answer"} ${i + 1}`}
                    onChange={(e) => updateAnswer(i, "text", e.target.value)}
                    onKeyDown={(e) => onAnswerKey(e, i)}
                    onPaste={(e) => onAnswerPaste(e, i)}
                  />
                  {shape?.match && (
                    <input
                      className="jqzz-answer-text"
                      value={a.match ?? ""}
                      placeholder={shape.match}
                      aria-label={`${shape.match} ${i + 1}`}
                      onChange={(e) => updateAnswer(i, "match", e.target.value)}
                    />
                  )}
                  {(!shape || shape.value) && (
                    <input
                      className="jqzz-answer-val"
                      type="number"
                      value={a.value}
                      aria-label={`Points for answer ${i + 1}`}
                      onChange={(e) => updateAnswer(i, "value", e.target.value)}
                    />
                  )}
                  <span className="jqzz-answer-tools">
                    {/* on touch there are no Alt arrows: these move it */}
                    <button
                      className="jqzz-answer-move"
                      onClick={() => moveAnswer(i, -1)}
                      disabled={i === 0}
                      aria-label={`move ${shape?.text ?? "answer"} ${i + 1} up`}
                    >
                      <Glyph name="UP" size={12} />
                    </button>
                    <button
                      className="jqzz-answer-move"
                      onClick={() => moveAnswer(i, 1)}
                      disabled={i === answers.length - 1}
                      aria-label={`move ${shape?.text ?? "answer"} ${i + 1} down`}
                    >
                      <Glyph name="DOWN" size={12} />
                    </button>
                    <button
                      className="jqzz-answer-del"
                      onClick={() => removeAnswer(i)}
                      aria-label={`remove ${shape?.text ?? "answer"} ${i + 1}`}
                      title="remove"
                    >
                      <Glyph name="TRASH" size={13} />
                    </button>
                  </span>
                </div>
              ))}
              {canAddAnswer && (
                <button
                  className="jqzz-add-answer"
                  onClick={() => commitAnswers([...answers, blankAnswer()], answers.length)}
                >
                  + add {shape!.text}
                </button>
              )}
              {canAddAnswer && answers.length > 0 && (
                <p className="jqzz-answer-keys">
                  <span>
                    <Keys combo="↵" /> next {shape!.text}
                  </span>
                  <span>
                    <Keys combo="Alt ↑" /> <Keys combo="Alt ↓" /> move it
                  </span>
                  <span>a pasted list fills a row a line</span>
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
};
