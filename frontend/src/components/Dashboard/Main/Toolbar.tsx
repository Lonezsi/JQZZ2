import React, { useEffect, useRef, useState } from "react";
import type { EditorMode, Quiz } from "../../../types";
import { useQuiz, type SaveState } from "../../../contexts/QuizContext";
import { Keys } from "../../common/Keys";
import { ariaShortcut, modLabel } from "../../../utils/shortcuts";

interface ToolbarProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  onOpenPalette: () => void;
  /** phone only: pulls the sidebar out */
  onMenu?: () => void;
  onStart: () => void;
  quiz?: Quiz;
  saveState?: SaveState;
}

/** "saving…" while it saves, "saved" for a moment after, nothing otherwise */
function useSaveNotice(saveState: SaveState | undefined) {
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(saveState);
  useEffect(() => {
    const was = prev.current;
    prev.current = saveState;
    if (saveState === "saved" && was === "saving") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustSaved(true);
      const t = window.setTimeout(() => setJustSaved(false), 1600);
      return () => window.clearTimeout(t);
    }
    if (saveState !== "saved") setJustSaved(false);
  }, [saveState]);

  if (saveState === "saving") return { text: "saving…", tone: "saving" };
  if (saveState === "error") return { text: "not saved, retrying", tone: "error" };
  if (justSaved) return { text: "saved", tone: "saved" };
  return null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  onOpenPalette,
  onMenu,
  onStart,
  quiz,
  saveState,
}) => {
  const { renameQuiz } = useQuiz();
  const notice = useSaveNotice(saveState);
  const canStart =
    !!quiz && quiz.actions.some((a) => a.phase !== "TEXT" && a.phase !== "DIVIDER");

  return (
    <div className="jqzz-toolbar">
      {/* only shown on a phone, where the sidebar is a drawer */}
      {onMenu && (
        <button className="jqzz-menu-btn" onClick={onMenu} aria-label="Quizzes and account">
          <span aria-hidden="true" />
        </button>
      )}
      <div className="jqzz-seg" role="group" aria-label="Editor mode" data-mode={mode}>
        <span className="jqzz-seg-thumb" aria-hidden="true" />
        <button aria-pressed={mode === "visual"} onClick={() => setMode("visual")}>
          Visual
        </button>
        <button aria-pressed={mode === "text"} onClick={() => setMode("text")}>
          Text
        </button>
      </div>

      <div className="jqzz-toolbar-title">
        {quiz ? (
          <input
            className="jqzz-toolbar-name"
            value={quiz.name}
            aria-label="Quiz name"
            title="click to rename"
            spellCheck={false}
            onChange={(e) => renameQuiz(quiz.id, e.target.value)}
            onBlur={(e) => {
              if (!e.target.value.trim()) renameQuiz(quiz.id, "untitled quiz");
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <span className="jqzz-annot">no quiz open</span>
        )}
      </div>

      <span
        className={`jqzz-save jqzz-annot${notice ? ` on is-${notice.tone}` : ""}`}
        role="status"
        aria-live="polite"
      >
        <span className="jqzz-save-dot" aria-hidden="true" />
        {notice?.text ?? ""}
      </span>

      <button
        className="jqzz-cmdk"
        onClick={onOpenPalette}
        aria-keyshortcuts={ariaShortcut("Mod K")}
      >
        <span className="jqzz-star" aria-hidden="true" />
        <span className="jqzz-cmdk-label">commands</span>
        <Keys combo="Mod K" />
      </button>
      {canStart && (
        <button
          className="jqzz-toolbar-btn run"
          onClick={onStart}
          aria-keyshortcuts={ariaShortcut("Mod ↵")}
          title={`start · ${modLabel("Mod ↵")}`}
        >
          <span aria-hidden="true">▶</span> Start
        </button>
      )}
    </div>
  );
};
