import React, { useEffect, useRef, useState } from "react";
import { useQuiz } from "../../contexts/QuizContext";
import { Glyph } from "./Glyph";

/**
 * Deletes a quiz, asking once: the first press arms it ("delete?"), a second
 * within three seconds does it. Used in the quiz list and in the open quiz.
 */
export const DeleteQuizButton: React.FC<{ quizId: number; name: string; className?: string; label?: boolean }> = ({
  quizId,
  name,
  className = "",
  label = false,
}) => {
  const { deleteQuiz } = useQuiz();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`jqzz-delete-quiz${armed ? " armed" : ""}${label ? " labelled" : ""} ${className}`}
      disabled={busy}
      title={armed ? `press again to delete ${name}` : `delete ${name}`}
      aria-label={armed ? `Confirm deleting ${name}` : `Delete ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!armed) {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
          return;
        }
        window.clearTimeout(timer.current);
        setBusy(true);
        deleteQuiz(quizId).finally(() => setBusy(false));
      }}
    >
      <Glyph name="CLOSE" size={12} />
      {(label || armed) && <span>{armed ? "delete?" : "delete"}</span>}
    </button>
  );
};
