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
  const [parseOk, setParseOk] = useState<boolean>(true);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const prevIdRef = useRef<number | undefined>(quiz?.id);

  // Re-seed when active quiz changes
  useEffect(() => {
    if (quiz?.id !== prevIdRef.current) {
      prevIdRef.current = quiz?.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(quizToScript(quiz));
    }
  }, [quiz]);

  const syncScroll = () => {
    if (taRef.current && preRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  // Parse when text changes, using existing questions from quiz actions
  useEffect(() => {
    const t = setTimeout(() => {
      if (!quiz) return;
      const existingQuestions = extractQuestionsFromActions(quiz);
      const { questions, actions, errors } = parseScript(
        text,
        existingQuestions,
      );
      setParseOk(errors.length === 0);
      onParsed(questions, actions);
    }, 650);
    return () => clearTimeout(t);
  }, [text, quiz, onParsed]); // Include quiz and onParsed dependencies

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = taRef.current!;
    const { selectionStart: s, selectionEnd: end } = ta;
    const next = text.slice(0, s) + "  " + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = s + 2;
    });
  };

  return (
    <div className="jqzz-text-editor">
      <div className="jqzz-ai-bar">
        <span className="jqzz-ai-label"># AI:</span>
        <input
          className="jqzz-ai-input"
          placeholder="Create a chaotic party quiz with memes..."
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
        />
        <span className={`jqzz-parse-badge${parseOk ? " ok" : " err"}`}>
          {parseOk ? "✓ valid" : "⚠ errors"}
        </span>
        <button
          className="jqzz-ai-btn"
          onClick={() => alert("Generating quiz from AI prompt...")}
        >
          Generate
        </button>
      </div>
      <div className="jqzz-editor-wrap">
        <pre ref={preRef} className="jqzz-highlight-pre" aria-hidden>
          <HighlightedScript text={text} />
        </pre>
        <textarea
          ref={taRef}
          className="jqzz-script-ta"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleTab}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
};
