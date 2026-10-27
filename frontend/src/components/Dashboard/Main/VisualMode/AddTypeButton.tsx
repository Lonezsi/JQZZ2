import React, { useState } from "react";
import type { Action, Question } from "../../../../types";
import { useAuth } from "../../../../contexts/AuthContext";
import { stashService } from "../../../../services/stashService";
import { setTypesCache } from "../../../../hooks/useTypes";
import { typeLabel } from "../../../../utils/questionInfo";
import { Glyph } from "../../../common/Glyph";

/**
 * Keeps this question's shape (its type, steps and answer slots, not its words)
 * as a type in your stash, so "add" can make more like it.
 */
export const AddTypeButton: React.FC<{ question: Question; actions: Action[] }> = ({ question, actions }) => {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (!user) return null;
  const save = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState("busy");
    stashService
      .addType(user.id, {
        name: `${typeLabel(question.type)}: ${question.text || "question"}`.slice(0, 60),
        questionType: question.type || "PREWRITTEN_SINGLE",
        answers: (question.answers ?? []).map((a) => ({ text: "", value: a.value ?? 0 })),
        steps: actions.map((a) => ({ phase: a.phase, time: a.time, preview: a.preview ?? "" })),
      })
      .then(() => stashService.list(user.id))
      .then((d) => {
        setTypesCache(user.id, d.items.filter((i) => i.kind === "TYPE"));
        setState("done");
        window.setTimeout(() => setState("idle"), 2200);
      })
      .catch(() => {
        setState("error");
        window.setTimeout(() => setState("idle"), 2200);
      });
  };
  return (
    <button
      type="button"
      className={`jqzz-add-type is-${state}`}
      onClick={save}
      disabled={state === "busy"}
      title="keep this question's type and steps in your stash, to add more like it"
    >
      <Glyph name={state === "done" ? "CHECK" : "TYPE"} size={12} />
      {state === "busy" ? "saving…" : state === "done" ? "type saved" : state === "error" ? "try again" : "add type"}
    </button>
  );
};
