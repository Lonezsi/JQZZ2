import React, { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../services/api";
import { historyService, stashService } from "../../services/stashService";
import type { HistoryRecord } from "../../types/stash";
import { typeLabel } from "../../utils/questionInfo";

/**
 * After a game: keep the whole quiz, or just the questions you liked. Reads the
 * game's record, so it works the same from the final screen and from history.
 */
export const SaveFromGame: React.FC<{
  recordId: number;
  me: string;
  /** starts folded behind one button, for the final screens */
  folded?: boolean;
  record?: HistoryRecord | null;
}> = ({ recordId, me, folded = false, record: given }) => {
  const [open, setOpen] = useState(!folded);
  const [record, setRecord] = useState<HistoryRecord | null>(given ?? null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  // unfolded under the podium, it would open out of sight
  useEffect(() => {
    if (open && folded) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, folded, record]);

  useEffect(() => {
    if (given) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecord(given);
      return;
    }
    if (!open || record || !me) return;
    let cancelled = false;
    historyService
      .get(me, recordId)
      .then((r) => !cancelled && setRecord(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [open, record, me, recordId, given]);

  const save = (key: string, questionKey?: number) => {
    setBusy(key);
    setError(null);
    stashService
      .fromGame(me, recordId, questionKey)
      .then(() => setSaved((s) => new Set(s).add(key)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(null));
  };

  if (!open) {
    return (
      <button className="jqzz-play-btn" onClick={() => setOpen(true)}>
        save to your stash
      </button>
    );
  }

  return (
    <section className="jqzz-keep" aria-label="Save to your stash" ref={panel}>
      <div className="jqzz-keep-head">
        <span className="jqzz-annot">save to your stash</span>
        <a className="jqzz-annot jqzz-keep-link" href="#/me/stash">
          open stash →
        </a>
      </div>
      <button
        className={`jqzz-play-btn${saved.has("quiz") ? "" : " primary"}`}
        disabled={busy !== null || saved.has("quiz")}
        onClick={() => save("quiz")}
      >
        {saved.has("quiz") ? "quiz saved ✓" : busy === "quiz" ? "saving…" : "the whole quiz"}
      </button>
      {!record && !error && <span className="jqzz-annot">loading the questions…</span>}
      {record && (
        <ol className="jqzz-keep-list">
          {record.content.questions.map((q, i) => {
            const key = `q${q.key}`;
            return (
              <li key={q.key} className="jqzz-keep-row">
                <span className="jqzz-board-rank">{i + 1}</span>
                <span className="jqzz-keep-text">
                  {q.text || "untitled question"}
                  <span className="jqzz-annot">{typeLabel(q.type)}</span>
                </span>
                <button
                  className="jqzz-play-btn small"
                  disabled={busy !== null || saved.has(key)}
                  onClick={() => save(key, q.key)}
                  aria-label={`Save question ${i + 1}`}
                >
                  {saved.has(key) ? "saved ✓" : busy === key ? "…" : "save"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {error && (
        <p className="jqzz-play-note bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
