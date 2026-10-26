import React, { useState, useEffect, useRef } from "react";
import type { Quiz, Question, Action } from "../../../../types";
import { quizToScript } from "../../../../utils/scriptSerializer";
import { parseScript } from "../../../../utils/scriptParser";
import { HighlightedScript } from "../../../../utils/syntaxHighlighterScript";

interface ScriptEditorProps {
  quiz: Quiz | undefined;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  onParsed: (questions: Question[], actions: Action[]) => void;
}

// Helper to extract unique questions in order of appearance from actions
const extractQuestionsFromActions = (quiz: Quiz | undefined): Question[] => {
  if (!quiz) return [];
  const seen = new Set<number>();
  const result: Question[] = [];
  for (const action of quiz.actions) {
    const q = action.question;
    if (q && !seen.has(q.id)) {
      seen.add(q.id);
      result.push(q);
    }
  }
  return result;
};

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  quiz,
  aiPrompt,
  onAiPromptChange,
  onParsed,
}) => {
  const [text, setText] = useState<string>(() => quizToScript(quiz));
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState({ questions: 0, actions: 0 });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const aiRef = useRef<HTMLInputElement>(null);

  // The script of the quiz state the text currently corresponds to. Only the
  // user's own edits are parsed back into the quiz; a quiz that changes in any
  // other way (switching quizzes, adding a snippet) re-seeds the text.
  const syncedScript = useRef(quizToScript(quiz));
  const hasUserEdits = useRef(false);
  const quizRef = useRef(quiz);
  useEffect(() => {
    quizRef.current = quiz;
  });

  useEffect(() => {
    const script = quizToScript(quiz);
    if (script === syncedScript.current) return;
    syncedScript.current = script;
    hasUserEdits.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(script);
  }, [quiz]);

  const edit = (next: string) => {
    hasUserEdits.current = true;
    setText(next);
  };

  const syncScroll = () => {
    if (taRef.current && preRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  // Parse after typing pauses; apply only scripts without errors, so a
  // half-typed line never wipes questions from the quiz.
  useEffect(() => {
    const t = setTimeout(() => {
      const current = quizRef.current;
      const { questions, actions, errors } = parseScript(
        text,
        extractQuestionsFromActions(current),
      );
      setErrors(errors);
      setSummary({ questions: questions.length, actions: actions.length });
      if (!current || !hasUserEdits.current || errors.length > 0) return;
      hasUserEdits.current = false;
      syncedScript.current = quizToScript({ ...current, actions });
      onParsed(questions, actions);
    }, 650);
    return () => clearTimeout(t);
  }, [text, onParsed]);

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = taRef.current!;
    const { selectionStart: s, selectionEnd: end } = ta;
    const next = text.slice(0, s) + "  " + text.slice(end);
    edit(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = s + 2;
    });
  };

  const parseOk = errors.length === 0;

  return (
    <div className="jqzz-text-editor jqzz-view-in">
      <div className="jqzz-ai-bar">
        <span className="jqzz-ai-label"># quick add</span>
        <input
          ref={aiRef}
          className="jqzz-ai-input"
          placeholder="type a question, it gets added to the end"
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
        />
        <span
          className={`jqzz-parse-badge${parseOk ? " ok" : " err"}`}
          role="status"
          title={errors.join("\n")}
        >
          {parseOk ? "valid" : `${errors.length} error${errors.length > 1 ? "s" : ""}`}
        </span>
        <button
          className="jqzz-ai-btn"
          title="adds a question with this text to the end of the script"
          onClick={() => {
            const prompt = aiPrompt.trim();
            if (!prompt) {
              aiRef.current?.focus();
              return;
            }
            const used = [...text.matchAll(/NewQuestion\s+Q(\d+)/g)].map((m) => Number(m[1]));
            const q = `Q${used.length > 0 ? Math.max(...used) + 1 : 1}`;
            const block = `NewQuestion ${q} (
  prompt: ${JSON.stringify(`${prompt}?`)},
  type: "prewritten-single",
  elaboration: "Add your explanation here",
  answers: [
    { text: "Answer A", value: 100 },
    { text: "Answer B", value: 0 },
  ],
)

ShowWaiting(${q}, time: 8)
ShowQuestion(${q}, time: 30)
ShowAnswers(${q}, time: 15)
ShowResult(${q}, time: 10)
`;
            const hasContent = text
              .split("\n")
              .some((l) => l.trim() && !l.trim().startsWith("#"));
            edit(
              hasContent
                ? `${text.trimEnd()}\n\n${block}`
                : `# ${prompt} — JQzz Script v1\n# Author: generated\n\n${block}`,
            );
          }}
        >
          Add
        </button>
      </div>
      {!parseOk && (
        <div className="jqzz-parse-errors" role="alert">
          {errors[0]}
          {errors.length > 1 && ` (+${errors.length - 1} more)`}. nothing gets
          applied until this is fixed.
        </div>
      )}
      <div className="jqzz-editor-wrap">
        <pre ref={preRef} className="jqzz-highlight-pre" aria-hidden>
          <HighlightedScript text={text} />
        </pre>
        <textarea
          ref={taRef}
          className="jqzz-script-ta"
          value={text}
          onChange={(e) => edit(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleTab}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Quiz script"
        />
      </div>
      <div className="jqzz-annot jqzz-script-status" aria-hidden="true">
        jqzz script v1 · {text.split("\n").length} lines · {summary.questions} questions ·{" "}
        {summary.actions} actions
      </div>
    </div>
  );
};
