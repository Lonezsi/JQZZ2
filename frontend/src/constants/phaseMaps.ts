import type { Phase } from "../types";

export const PHASE_FN_MAP: Partial<Record<Phase, string>> = {
  WAITING: "ShowWaiting",
  QUESTION: "ShowQuestion",
  ANSWER: "ShowAnswers",
  ELABORATION: "ShowElaboration",
  RESULT: "ShowResult",
};

export const FN_PHASE_MAP: Record<string, Phase> = {
  ShowWaiting: "WAITING",
  ShowQuestion: "QUESTION",
  ShowAnswers: "ANSWER",
  ShowElaboration: "ELABORATION",
  ShowResult: "RESULT",
};
