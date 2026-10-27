import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { go } from "../../hooks/useHashRoute";
import { errorMessage } from "../../services/api";
import { historyService } from "../../services/stashService";
import { playService } from "../../services/playService";
import type { HistoryRecord, HistorySummary, QuestionResult, StashedQuestion } from "../../types/stash";
import { PlayFrame } from "../Play/PlayCommon";
import { BackButton } from "../common/BackButton";
import { SaveFromGame } from "./SaveFromGame";
import { plural, when } from "../../utils/format";
import { typeLabel } from "../../utils/questionInfo";

/**
 * Games as a timeline, newest on top: where you (or whoever's profile it is)
 * placed, how many played, who made the podium.
 */
export const GameList: React.FC<{ games: HistorySummary[]; me: string; empty: React.ReactNode }> = ({
  games,
  me,
  empty,
}) => {
  if (games.length === 0) return <p className="jqzz-shelf-empty">{empty}</p>;
  return (
    <ol className="jqzz-timeline-games">
      {games.map((g, i) => (
        <li key={g.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
          <span className="jqzz-when jqzz-annot">{when(g.finishedAt)}</span>
          <a className="jqzz-game-row" href={`#/history/${g.id}`}>
            <span className={`jqzz-game-place${g.you?.ranking === 1 && g.playerCount > 1 ? " first" : ""}`}>
              {g.you ? `#${g.you.ranking}` : "host"}
            </span>
            <span className="jqzz-shelf-body">
              <span className="jqzz-shelf-title">{g.quizName || "untitled quiz"}</span>
              <span className="jqzz-annot">
                {g.playerCount === 1 && g.you ? "alone" : plural(g.playerCount, "player")}
                {g.you && ` · ${g.you.score} pts`}
              </span>
              {g.playerCount > 1 && (
                <span className="jqzz-game-podium">
                  {g.podium.slice(0, 3).map((p) => (
                    <span key={p.userId} className={p.userId === me ? "me" : undefined}>
                      {p.ranking}. {p.name}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="jqzz-game-go" aria-hidden="true">
              →
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
};

/** One game: the scores, what everyone answered, save from it, play it again. */
export const HistoryPage: React.FC<{ id: string }> = ({ id }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const recordId = /^\d+$/.test(id) ? Number(id) : null;
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || recordId == null) return;
    let cancelled = false;
    historyService
      .get(me, recordId)
      .then((r) => !cancelled && setRecord(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [me, recordId]);

  const rematch = () => {
    if (!record) return;
    setBusy(true);
    setError(null);
    playService
      .rematch(me, record.id)
      .then((game) => go(`/host/${game.code}`))
      .catch((err) => {
        setError(errorMessage(err));
        setBusy(false);
      });
  };

  return (
    <PlayFrame phase="ANSWER">
      <div className="jqzz-space jqzz-space-history">
        <header className="jqzz-play-bar compact">
          <BackButton to="/me/history" title="all your games" />
          <span className="jqzz-play-title">{record?.quizName ?? "game"}</span>
        </header>
        <main className="jqzz-shelf">
          {error && <p className="jqzz-play-note bad">{error}</p>}
          {!record && !error && <p className="jqzz-annot jqzz-shelf-empty">loading…</p>}
          {record && (
            <div className="jqzz-game">
              <h1 className="jqzz-stage-title OEF jqzz-chroma">{record.quizName || "untitled quiz"}</h1>
              <p className="jqzz-annot">
                {when(record.finishedAt)} ·{" "}
                {record.hosted ? "you hosted" : `you came #${record.you?.ranking}`} · code {record.code}
              </p>
              <div className="jqzz-play-row">
                <button className="jqzz-play-btn primary" onClick={rematch} disabled={busy || !record.quizId}>
                  {busy ? "starting…" : "rematch"}
                </button>
              </div>
              <p className="jqzz-annot">a rematch hosts it again and invites everyone who was in it</p>
              <ol className="jqzz-board">
                {record.players.map((p, i) => (
                  <li
                    key={p.userId}
                    className={`jqzz-board-row${p.userId === me ? " me" : ""}`}
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <span className="jqzz-board-rank">{p.ranking}</span>
                    <a className="jqzz-board-name" href={`#/u/${p.userId}`}>
                      {p.name}
                    </a>
                    <span className="jqzz-board-score">{p.score}</span>
                  </li>
                ))}
              </ol>
              <Answers record={record} me={me} />
              <SaveFromGame recordId={record.id} me={me} record={record} />
            </div>
          )}
        </main>
      </div>
    </PlayFrame>
  );
};

/** Every question as it was played: what was picked, ranked, written. */
const Answers: React.FC<{ record: HistoryRecord; me: string }> = ({ record, me }) => {
  const results = record.content.results ?? {};
  const asked = record.content.questions.filter((q) => {
    const r = results[String(q.key)];
    return r && Object.keys(r).length > 0;
  });
  if (asked.length === 0) return null;
  return (
    <section className="jqzz-answers" aria-label="What everyone answered">
      <h2 className="jqzz-annot">what everyone answered</h2>
      <ol>
        {asked.map((q, i) => (
          <li key={q.key} className="jqzz-answer-card" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <div className="jqzz-answer-head">
              <span className="jqzz-board-rank">{i + 1}</span>
              <span className="jqzz-keep-text">
                {q.text || "untitled question"}
                <span className="jqzz-annot">{typeLabel(q.type)}</span>
              </span>
              {results[String(q.key)].gains?.[me] ? (
                <span className="jqzz-board-gain">+{results[String(q.key)].gains?.[me]}</span>
              ) : null}
            </div>
            <Result q={q} r={results[String(q.key)]} />
          </li>
        ))}
      </ol>
    </section>
  );
};

const Result: React.FC<{ q: StashedQuestion; r: QuestionResult }> = ({ q, r }) => {
  if (r.counts) {
    const total = Math.max(1, r.counts.reduce((a, b) => a + b, 0));
    return (
      <ul className="jqzz-bars">
        {q.answers.map((a, i) => (
          <li key={i} className={a.value > 0 ? "right" : undefined}>
            <span className="jqzz-bars-text">{a.text || "…"}</span>
            <span className="jqzz-bars-track">
              <span style={{ width: `${((r.counts?.[i] ?? 0) / total) * 100}%` }} />
            </span>
            <span className="jqzz-annot">{r.counts?.[i] ?? 0}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (r.tiers) {
    return (
      <ul className="jqzz-tier-recap">
        {q.answers.map((a, i) => (
          <li key={i}>
            <b className={`tier-${r.tiers?.[i] ?? "none"}`}>{r.tiers?.[i] ?? "–"}</b>
            {a.text}
          </li>
        ))}
      </ul>
    );
  }
  if (r.entries) {
    if (r.entries.length === 0) return <p className="jqzz-annot">nobody wrote anything</p>;
    return (
      <>
        {r.champion && (
          <p className="jqzz-champion">
            won: <b>{r.champion.text}</b> by {r.champion.by}
          </p>
        )}
        <ul className="jqzz-entries-recap">
          {[...r.entries]
            .sort((a, b) => b.votes - a.votes)
            .map((e, i) => (
              <li key={i}>
                <span className="jqzz-entry-text">“{e.text}”</span>
                <span className="jqzz-annot">
                  {e.by}
                  {e.votes > 0 && ` · ${e.votes}`}
                </span>
              </li>
            ))}
        </ul>
      </>
    );
  }
  return null;
};
