import React, { useState, useEffect } from "react";
import type { Action, Question, Answer, Phase } from "../../../types";
import { generateId } from "../../../utils/idGenerator";

interface ContextEditorProps {
  action: Action | null;
  question: Question | null;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
}

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
    return (
      <div style={{ color: "var(--txt3)", fontSize: 12, marginTop: 12 }}>
        Select an action card to edit.
      </div>
    );
  }

  if (action.phase === "TEXT" || action.phase === "DIVIDER") {
    return (
      <div style={{ color: "var(--txt3)", fontSize: 12, marginTop: 12 }}>
        {action.phase === "TEXT" && (
          <>
            <div className="jqzz-section-label">Text Note</div>
            <div className="jqzz-field-group">
              <div className="jqzz-field-label">Content</div>
              <textarea
                className="jqzz-field-textarea"
                value={action.preview}
                onChange={(e) =>
                  onActionUpdate(action.id, { preview: e.target.value })
                }
              />
            </div>
          </>
        )}
        {action.phase === "DIVIDER" && (
          <div style={{ color: "var(--txt3)", fontSize: 11 }}>
            Visual divider — separates sections in the timeline.
          </div>
        )}
      </div>
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
      <div className="jqzz-section-label">Phase</div>
      <div className="jqzz-field-group">
        <div className="jqzz-field-label">Type</div>
        <select
          className="jqzz-field-select"
          value={action.phase}
          onChange={(e) =>
            onActionUpdate(action.id, { phase: e.target.value as Phase })
          }
        >
          {(
            ["WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"] as const
          ).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="jqzz-field-group">
        <div className="jqzz-field-label">Duration (s)</div>
        <input
          className="jqzz-field-input"
          type="number"
          value={action.time}
          onChange={(e) =>
            onActionUpdate(action.id, { time: Number(e.target.value) })
          }
        />
      </div>
      {question && (
        <>
          <div className="jqzz-divider-sep" />
          <div className="jqzz-section-label">Question</div>
          <div className="jqzz-field-group">
            <div className="jqzz-field-label">Prompt</div>
            <textarea
              className="jqzz-field-textarea"
              value={question.text}
              onChange={(e) =>
                onQuestionUpdate(question.id, { text: e.target.value })
              }
            />
          </div>
          <div className="jqzz-field-group">
            <div className="jqzz-field-label">Image URL</div>
            <input
              className="jqzz-field-input"
              placeholder="optional..."
              value={question.imageUrl || ""}
              onChange={(e) =>
                onQuestionUpdate(question.id, { imageUrl: e.target.value })
              }
            />
          </div>
          <div className="jqzz-field-group">
            <div className="jqzz-field-label">Elaboration</div>
            <textarea
              className="jqzz-field-textarea"
              style={{ minHeight: 44 }}
              value={question.elaborationText || ""}
              onChange={(e) =>
                onQuestionUpdate(question.id, {
                  elaborationText: e.target.value,
                })
              }
            />
          </div>
          {(answers.length > 0 || question.type !== "USER_GENERATED") && (
            <>
              <div className="jqzz-divider-sep" />
              <div className="jqzz-section-label">Answers</div>
              {answers.map((a, i) => (
                <div key={a.id} className="jqzz-answer-row">
                  <input
                    className="jqzz-answer-text"
                    value={a.text}
                    placeholder="Answer..."
                    onChange={(e) => updateAnswer(i, "text", e.target.value)}
                  />
                  <input
                    className="jqzz-answer-val"
                    type="number"
                    value={a.value}
                    onChange={(e) => updateAnswer(i, "value", e.target.value)}
                  />
                  <button
                    className="jqzz-answer-del"
                    onClick={() => removeAnswer(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="jqzz-add-answer" onClick={addAnswer}>
                + Add Answer
              </button>
            </>
          )}
        </>
      )}
    </>
  );
};
