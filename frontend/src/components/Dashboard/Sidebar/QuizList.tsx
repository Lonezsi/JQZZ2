import React from "react";
import type { Quiz } from "../../../types";

interface QuizListProps {
  quizzes: Quiz[];
  activeQuizId: number | null;
  onSelectQuiz: (id: number) => void;
}

export const QuizList: React.FC<QuizListProps> = ({
  quizzes,
  activeQuizId,
  onSelectQuiz,
}) => {
  return (
    <div
      className="jqzz-sid-section"
      style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
    >
      <div className="jqzz-sid-label">Recent Quizzes</div>
      {quizzes.map((q) => (
        <div
          key={q.id}
          className={`jqzz-quiz-item${q.id === activeQuizId ? " active" : ""}`}
          onClick={() => onSelectQuiz(q.id)}
        >
          <span className="jqzz-quiz-dot" />
          <span className="jqzz-quiz-name">{q.name}</span>
        </div>
      ))}
    </div>
  );
};
