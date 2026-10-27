import React from "react";
import type { Quiz } from "../../../types";
import { formatTimecode, quizCode, quizRuntime } from "../../../utils/timecode";
import { matchQuiz } from "../../../utils/quizSearch";
import { Keys } from "../../common/Keys";
import { DeleteQuizButton } from "../../common/DeleteQuizButton";

interface QuizListProps {
  quizzes: Quiz[];
  query: string;
  activeQuizId: number | null;
  onSelectQuiz: (id: number) => void;
  /** nothing matched: make a quiz called what was searched for */
  onCreate?: (name: string) => void;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

export const QuizList: React.FC<QuizListProps> = ({
  quizzes,
  query,
  activeQuizId,
  onSelectQuiz,
  onCreate,
}) => {
  const results = quizzes
    .map((q) => ({ q, m: matchQuiz(q, query) }))
    .filter((r) => r.m.hit);

  return (
    <nav className="jqzz-quiz-list" aria-label="Quizzes">
      {quizzes.length === 0 && (
        <div className="jqzz-sid-empty">none yet. make one above.</div>
      )}
      {quizzes.length > 0 && results.length === 0 && (
        <div className="jqzz-sid-empty">nothing called that, and no question says it either.</div>
      )}
      {query.trim() && results.length === 0 && onCreate && (
        <button className="jqzz-sid-action jqzz-make-named" onClick={() => onCreate(query.trim())}>
          <span className="jqzz-plus" aria-hidden="true" />
          <span className="jqzz-make-named-text">
            make a quiz named <b>{query.trim()}</b>
          </span>
          <Keys combo="↵" />
        </button>
      )}
      {query.trim() && results.length > 0 && (
        <div className="jqzz-annot jqzz-search-count" role="status">
          {results.length} of {quizzes.length}
        </div>
      )}
      {results.map(({ q, m }) => {
        const active = q.id === activeQuizId;
        return (
          <div key={q.id} className={`jqzz-quiz-row${active ? " active" : ""}`}>
          <button
            className={`jqzz-quiz-item${active ? " active" : ""}`}
            aria-current={active ? "true" : undefined}
            title={
              active
                ? undefined
                : `${quizCode(q.id)} · ${q.actions.length} actions · ${formatTimecode(quizRuntime(q))}`
            }
            onClick={() => onSelectQuiz(q.id)}
          >
            <span className="jqzz-quiz-name">
              <Highlight text={q.name} query={query} />
            </span>
            {/* its phases in their colours, one tick each */}
            <span className="jqzz-quiz-rhythm" aria-hidden="true">
              {q.actions
                .filter((a) => a.phase !== "TEXT" && a.phase !== "DIVIDER")
                .slice(0, 28)
                .map((a) => (
                  <span
                    key={a.id}
                    style={{ background: `var(--phase-${a.phase})`, flexGrow: Math.max(1, Math.min(a.time, 40)) }}
                  />
                ))}
            </span>
            {m.via && (
              <span className="jqzz-quiz-via">
                “<Highlight text={m.via} query={query} />”
              </span>
            )}
            {/* details only for the open quiz; others show them as a tooltip */}
            <span className="jqzz-quiz-meta-wrap">
              <span className="jqzz-annot jqzz-quiz-meta">
                {quizCode(q.id)} · {q.actions.length} act · {formatTimecode(quizRuntime(q))}
              </span>
            </span>
          </button>
          <DeleteQuizButton quizId={q.id} name={q.name} authorId={q.authorId} className="in-list" />
          </div>
        );
      })}
    </nav>
  );
};
