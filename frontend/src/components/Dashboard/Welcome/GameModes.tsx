import React, { useState } from "react";
import { useQuiz } from "../../../contexts/QuizContext";
import { useAuth } from "../../../contexts/AuthContext";
import { GAME_MODES, type GameMode } from "../../../modes";
import { describe, modeKey } from "../../../utils/questionTypes";
import { playService } from "../../../services/playService";
import { errorMessage } from "../../../services/api";
import { go } from "../../../hooks/useHashRoute";
import { Glyph } from "../../common/Glyph";

/**
 * Ready-made quizzes, one per way of playing. Host one as it is, or open it
 * to change it: either way it becomes a quiz of your own, made once and
 * reused after.
 */
export const GameModes: React.FC = () => {
  const { quizzes, importScript, setActiveQuizId } = useQuiz();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  /** your copy of it: the one made before, or a new one */
  const copyOf = async (m: GameMode) => {
    const have = quizzes.find((q) => q.name === m.name && q.authorId === user?.id);
    if (have) {
      setActiveQuizId(have.id);
      return have;
    }
    return importScript(m.name, m.script);
  };

  const open = async (m: GameMode) => {
    setBusy(m.id);
    try {
      await copyOf(m);
    } finally {
      setBusy(null);
    }
  };

  const host = async (m: GameMode) => {
    if (!user) return;
    setBusy(m.id);
    try {
      const quiz = await copyOf(m);
      if (!quiz) return;
      const game = await playService.host(quiz.id, user.id);
      go(`/host/${game.code}`);
    } catch (err) {
      alert(`couldn't start it: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="jqzz-modes" aria-label="Game modes">
      <div className="jqzz-modes-head">
        <span className="jqzz-annot">game modes</span>
        <p>ready to play. host one as it is, or open it and make it yours.</p>
      </div>
      <div className="jqzz-modes-grid">
        {GAME_MODES.map((m, i) => (
          <article key={m.id} className="jqzz-mode" style={{ "--i": i } as React.CSSProperties} aria-busy={busy === m.id}>
            <div className="jqzz-mode-glyphs" aria-label={m.modes.map((x) => describe(x).label).join(", ")}>
              {m.modes.map((x) => (
                <span key={modeKey(x)} title={describe(x).label}>
                  <Glyph name={describe(x).icon} size={14} />
                </span>
              ))}
            </div>
            <h3>{m.name}</h3>
            <p>{m.about}</p>
            <span className="jqzz-annot">
              {m.players} players · about {m.minutes} min · {m.questions} {m.questions === 1 ? "question" : "questions"}
            </span>
            <div className="jqzz-mode-actions">
              <button className="jqzz-toolbar-btn run" onClick={() => host(m)} disabled={busy !== null}>
                {busy === m.id ? "one sec..." : "host it"}
              </button>
              <button className="jqzz-toolbar-btn" onClick={() => open(m)} disabled={busy !== null}>
                open
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
