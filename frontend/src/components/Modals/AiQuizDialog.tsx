import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../../hooks/useEscape";
import { useQuiz } from "../../contexts/QuizContext";
import { aiReference, errorsForAI, extractScript, titleOf } from "../../utils/aiReference";
import { parseScript } from "../../utils/scriptParser";
import { copyText } from "./copyText";

interface AiQuizDialogProps {
  onClose: () => void;
}

/** problems listed before "and {k} more" */
const SHOWN_PROBLEMS = 12;

/**
 * Making a quiz with a chat AI, in two steps: copy a guide (with what the
 * quiz should be about) into any AI, then paste back what it writes. The
 * answer is read the forgiving way, and when the reader still finds problems
 * they're listed, worded so they can go straight back to the same chat.
 */
export const AiQuizDialog: React.FC<AiQuizDialogProps> = ({ onClose }) => {
  useEscape(true, onClose);
  const { importScript } = useQuiz();
  const [request, setRequest] = useState("");
  const [pasted, setPasted] = useState("");
  // the last copy: which one, and whether the clipboard took it
  const [copied, setCopied] = useState<{ what: "guide" | "problems"; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // what the reader found in the last try; cleared when the paste changes
  const [problems, setProblems] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const requestRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestRef.current?.focus();
  }, []);

  const copy = (text: string, what: "guide" | "problems") =>
    copyText(text).then((ok) => setCopied({ what, ok }));

  const make = async (script: string) => {
    setBusy(true);
    const made = await importScript(titleOf(script) ?? "quiz from an AI", script);
    if (made) onClose();
    else setBusy(false);
  };

  const tryIt = () => {
    const script = extractScript(pasted);
    const { errors, warnings } = parseScript(script, []);
    if (errors.length || warnings.length) {
      setProblems({ errors, warnings });
      return;
    }
    void make(script);
  };

  const all = problems ? [...problems.errors, ...problems.warnings] : [];

  // portaled, like the other dialogs: a blurred ancestor would clip a fixed overlay
  return createPortal(
    <div className="jqzz-modal-overlay" onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      <div
        className="jqzz-modal wide jqzz-aikit jqzz-holo sheen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jqzz-aikit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jqzz-holo-dust" aria-hidden="true" />
        <div className="jqzz-modal-head">
          <h3 id="jqzz-aikit-title" className="jqzz-chroma">
            make a quiz with an AI
          </h3>
          <button className="jqzz-modal-btn ghost" onClick={onClose}>
            close
          </button>
        </div>

        <section className="jqzz-aikit-step">
          <h4>1. say what it's about, then copy this to an AI</h4>
          <label className="jqzz-field-label" htmlFor="jqzz-aikit-request">
            what should the quiz be about?
          </label>
          <div className="jqzz-modal-inline">
            <input
              ref={requestRef}
              id="jqzz-aikit-request"
              className="jqzz-modal-input"
              placeholder="a party quiz about what we all did yesterday"
              value={request}
              onChange={(e) => {
                setRequest(e.target.value);
                if (copied?.what === "guide") setCopied(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") copy(aiReference(request), "guide");
              }}
            />
            <button className="jqzz-ai-btn" onClick={() => copy(aiReference(request), "guide")}>
              copy for AI
            </button>
          </div>
          {copied?.what === "guide" && <CopyNote ok={copied.ok}>copied. paste it into ChatGPT or any other chat AI.</CopyNote>}
        </section>

        <section className="jqzz-aikit-step">
          <h4>2. paste what it writes back</h4>
          <textarea
            className="jqzz-modal-input jqzz-field-textarea"
            aria-label="what the AI wrote"
            placeholder="paste the AI's whole answer here. extra words around the script are fine."
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setProblems(null);
              if (copied?.what === "problems") setCopied(null);
            }}
          />
          {problems && (
            <div className="jqzz-aikit-problems" role="alert">
              <p>a few things to fix first:</p>
              <ul>
                {all.slice(0, SHOWN_PROBLEMS).map((p, i) => (
                  <li key={i} className={i >= problems.errors.length ? "warn" : undefined}>
                    {p}
                  </li>
                ))}
              </ul>
              {all.length > SHOWN_PROBLEMS && <p className="jqzz-annot">and {all.length - SHOWN_PROBLEMS} more</p>}
              <div className="jqzz-modal-row">
                <button className="jqzz-modal-btn" onClick={() => copy(errorsForAI(all), "problems")}>
                  copy problems for the AI
                </button>
                {problems.errors.length === 0 && (
                  <button className="jqzz-modal-btn" disabled={busy} onClick={() => make(extractScript(pasted))}>
                    make it anyway
                  </button>
                )}
              </div>
              {copied?.what === "problems" && (
                <CopyNote ok={copied.ok}>copied. paste it into the same chat and bring back the new answer.</CopyNote>
              )}
            </div>
          )}
          <div className="jqzz-modal-row">
            <button className="jqzz-modal-btn primary" disabled={busy || !pasted.trim()} onClick={tryIt}>
              {busy ? "making it..." : "make the quiz"}
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
};

/** what a copy button did: the next step, or that the clipboard said no */
const CopyNote: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) =>
  ok ? (
    <p className="jqzz-annot" role="status">
      {children}
    </p>
  ) : (
    <p className="jqzz-modal-error" role="alert">
      couldn't reach the clipboard. try the button again.
    </p>
  );
