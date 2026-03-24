import React, { useState } from "react";
import type { Action, Question, RightTab } from "../../../types";
import { UsersTab } from "./UsersTab";
import { ContextEditor } from "./ContextEditor";

interface RightPanelProps {
  selectedAction: Action | null;
  multipleSelected: boolean;
  onActionUpdate: (id: number, patch: Partial<Action>) => void;
  onQuestionUpdate: (id: number, patch: Partial<Question>) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedAction,
  multipleSelected,
  onActionUpdate,
  onQuestionUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<RightTab>("context");

  const action = selectedAction;
  const question = action?.question ?? null;

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
        ) : multipleSelected ? (
          <div style={{ color: "var(--txt3)", fontSize: 12, marginTop: 12 }}>
            Multiple actions selected. Click on a single action to edit.
          </div>
        ) : !action ? (
          <div style={{ color: "var(--txt3)", fontSize: 12, marginTop: 12 }}>
            Select an action card to edit.
          </div>
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
