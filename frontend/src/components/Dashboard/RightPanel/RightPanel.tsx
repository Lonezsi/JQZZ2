import React, { useState } from "react";
import type { Action, Question, RightTab } from "../../../types";
import { UsersTab } from "./UsersTab";
import { ContextEditor } from "./ContextEditor";
import { useQuiz } from "../../../contexts/QuizContext";

interface RightPanelProps {
  selectedAction: Action | null;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedAction,
  onActionUpdate,
  onQuestionUpdate,
}) => {
  const { questionMap } = useQuiz();
  const [activeTab, setActiveTab] = useState<RightTab>("context");

  const action = selectedAction;
  const question = action ? (questionMap.get(action.questionId) ?? null) : null;

  const contextLabel = action
    ? action.phase === "TEXT" || action.phase === "DIVIDER"
      ? action.phase
      : action.phase
    : "Context";

  return (
    <div className="jqzz-rpanel">
      <div className="jqzz-rpanel-tabs">
        <button
          className={`jqzz-rpanel-tab${activeTab === "context" ? " active" : ""}`}
          onClick={() => setActiveTab("context")}
        >
          {contextLabel}
        </button>
        <button
          className={`jqzz-rpanel-tab${activeTab === "users" ? " active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
      </div>
      <div className="jqzz-rpanel-body">
        {activeTab === "users" ? (
          <UsersTab />
        ) : (
          <ContextEditor
            action={action}
            question={question}
            onActionUpdate={onActionUpdate}
            onQuestionUpdate={onQuestionUpdate}
          />
        )}
      </div>
    </div>
  );
};
