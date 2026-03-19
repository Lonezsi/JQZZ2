import React from "react";
import type { Quiz, Question, Action } from "../../../../types";
import { ScriptEditor } from "./ScriptEditor";

interface TextModeProps {
  quiz: Quiz | undefined;
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  onParsed: (questions: Question[], actions: Action[]) => void;
}

export const TextMode: React.FC<TextModeProps> = ({
  quiz,
  aiPrompt,
  setAiPrompt,
  onParsed,
}) => {
  return (
    <ScriptEditor
      quiz={quiz}
      aiPrompt={aiPrompt}
      onAiPromptChange={setAiPrompt}
      onParsed={onParsed}
    />
  );
};
