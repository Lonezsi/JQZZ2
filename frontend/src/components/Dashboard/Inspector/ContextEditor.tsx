import React, { useState, useEffect } from "react";
import type { Action, Question, Answer, Phase } from "../../../types";
import { generateId } from "../../../utils/idGenerator";
import { ImagePicker } from "../../Modals/ImagePicker";
import { Glyph } from "../../common/Glyph";
import { QUESTION_TYPE_LABEL } from "../../../utils/questionInfo";

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
          <select
            id="jqzz-phase"
            className="jqzz-field-select"
            value={action.phase}
            onChange={(e) => onActionUpdate(action.id, { phase: e.target.value as Phase })}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p.toLowerCase()}
              </option>
            ))}
          </select>
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
            <div className="jqzz-select-glyph">
              <Glyph name={question.type || "PREWRITTEN_SINGLE"} size={14} />
              <select
                id="jqzz-qtype"
                className="jqzz-field-select"
                value={question.type || "PREWRITTEN_SINGLE"}
                onChange={(e) => onQuestionUpdate(question.id, { type: e.target.value })}
              >
                {Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
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
