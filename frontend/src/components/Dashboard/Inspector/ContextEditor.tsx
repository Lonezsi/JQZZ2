import React, { useState, useEffect } from "react";
import type { Action, Question, Answer, Phase } from "../../../types";
import { generateId } from "../../../utils/idGenerator";
import { ImagePicker } from "../../Modals/ImagePicker";
import { QUESTION_TYPE_LABEL } from "../../../utils/questionInfo";
import { Select } from "../../common/Select";
import { SETTING_LABEL, formatSettings, parseSettings } from "../../../utils/settings";
import type { QuizSettings } from "../../../utils/settings";

interface ContextEditorProps {
  action: Action | null;
  question: Question | null;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
}

const PHASES = ["WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"] as const;

export const ContextEditor: React.FC<ContextEditorProps> = ({
  action,
  question,
  onActionUpdate,
  onQuestionUpdate,
}) => {
  const [answers, setAnswers] = useState<Answer[]>(question?.answers ?? []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(question?.answers ?? []);
  }, [question?.id, question?.answers]);

  if (!action) {
    return <p className="jqzz-panel-hint">click a card to edit it.</p>;
  }

  if (action.phase === "DIVIDER") {
    return (
      <p className="jqzz-panel-hint">
        just a line that splits the quiz into sections. it's skipped when the quiz runs.
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
    const flags: ("shuffle" | "mix" | "grade")[] = ["shuffle", "mix", "grade"];
    return (
      <>
        <div className="jqzz-section-label">settings from here on</div>
        {flags.map((k) => (
          <div key={k} className="jqzz-field-group">
            <label className="jqzz-field-label" htmlFor={`jqzz-set-${k}`}>
              {SETTING_LABEL[k]}
            </label>
            <Select
              id={`jqzz-set-${k}`}
              value={s[k] === undefined ? "" : s[k] ? "on" : "off"}
              onChange={(v) => set({ [k]: v === "" ? undefined : v === "on" })}
              options={[
                { value: "", label: "keep as it was", icon: "RESET" },
                { value: "on", label: "on", icon: "CHECK" },
                { value: "off", label: "off", icon: "CLOSE" },
              ]}
            />
          </div>
        ))}
        <div className="jqzz-field-group">
          <label className="jqzz-field-label" htmlFor="jqzz-set-points">
            {SETTING_LABEL.points}
          </label>
          <Select
            id="jqzz-set-points"
            value={s.points === undefined ? "" : String(s.points)}
            onChange={(v) => set({ points: v === "" ? undefined : Number(v) })}
            options={[
              { value: "", label: "keep as it was", icon: "RESET" },
              ...[0.5, 1, 2, 3].map((n) => ({ value: String(n), label: `×${n}`, text: String(n), icon: "STAR" })),
            ]}
          />
        </div>
        <p className="jqzz-panel-hint">
          these hold for every question after this block, until another block changes them. in text
          mode it's a group: <code>shuffle {"{"}</code> … <code>{"}"}</code>
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

  const addAnswer = () => {
    const next = [...answers, { id: generateId(), text: "", value: 0 }];
    setAnswers(next);
    if (question) onQuestionUpdate(question.id, { answers: next });
  };

  const removeAnswer = (idx: number) => {
    const next = answers.filter((_, i) => i !== idx);
    setAnswers(next);
    if (question) onQuestionUpdate(question.id, { answers: next });
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
            <label className="jqzz-field-label" htmlFor="jqzz-qtype">
              type
            </label>
            <Select
              id="jqzz-qtype"
              value={question.type || "PREWRITTEN_SINGLE"}
              onChange={(v) => onQuestionUpdate(question.id, { type: v })}
              options={Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => ({ value, label, icon: value }))}
            />
          </div>
          <div className="jqzz-field-group">
            <label className="jqzz-field-label" htmlFor="jqzz-prompt">
              prompt
            </label>
            <textarea
              id="jqzz-prompt"
              className="jqzz-field-textarea"
              value={question.text}
              onChange={(e) => onQuestionUpdate(question.id, { text: e.target.value })}
            />
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
              value={question.elaborationText || ""}
              onChange={(e) =>
                onQuestionUpdate(question.id, { elaborationText: e.target.value })
              }
            />
          </div>
          {(answers.length > 0 || question.type !== "USER_GENERATED") && (
            <>
              <div className="jqzz-section-label">
                answers <span className="jqzz-section-count">{answers.length}</span>
              </div>
              {answers.length > 0 && (
                <div className="jqzz-answer-head" aria-hidden="true">
                  <span>answer</span>
                  <span>points</span>
                </div>
              )}
              {answers.map((a, i) => (
                <div key={a.id} className="jqzz-answer-row">
                  <input
                    className="jqzz-answer-text"
                    value={a.text}
                    placeholder="answer"
                    aria-label={`Answer ${i + 1}`}
                    onChange={(e) => updateAnswer(i, "text", e.target.value)}
                  />
                  <input
                    className="jqzz-answer-val"
                    type="number"
                    value={a.value}
                    aria-label={`Points for answer ${i + 1}`}
                    onChange={(e) => updateAnswer(i, "value", e.target.value)}
                  />
                  <button
                    className="jqzz-answer-del"
                    onClick={() => removeAnswer(i)}
                    aria-label={`Remove answer ${i + 1}`}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="jqzz-add-answer" onClick={addAnswer}>
                + Add answer
              </button>
            </>
          )}
        </>
      )}
    </>
  );
};
