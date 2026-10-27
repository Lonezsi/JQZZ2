import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { go } from "../../hooks/useHashRoute";
import { errorMessage } from "../../services/api";
import { historyService } from "../../services/stashService";
import type { HistoryRecord, HistorySummary } from "../../types/stash";
import { PlayFrame } from "../Play/PlayCommon";
import { SaveFromGame } from "./SaveFromGame";
import { plural, when } from "../../utils/format";

/** The games you hosted or played, newest first; one of them when there's an id. */
export const HistoryPage: React.FC<{ id?: string }> = ({ id }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const recordId = id && /^\d+$/.test(id) ? Number(id) : null;

  return (
    <PlayFrame>
      <header className="jqzz-play-bar compact">
        <button
          className="jqzz-play-btn ghost"
          onClick={() => go(recordId ? "/history" : "/")}
          title={recordId ? "all your games" : "back to the editor"}
        >
          ←
        </button>
        <span className="jqzz-play-title">{recordId ? "game" : "history"}</span>
        <a className="jqzz-play-btn ghost" href="#/stash">
          stash
        </a>
      </header>
      <main className="jqzz-shelf">
        {me && (recordId ? <GameDetail id={recordId} me={me} /> : <GameList me={me} />)}
      </main>
    </PlayFrame>
  );
};

const GameList: React.FC<{ me: string }> = ({ me }) => {
  const [games, setGames] = useState<HistorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    historyService
      .list(me)
      .then((g) => !cancelled && setGames(g))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [me]);

  if (error) return <p className="jqzz-play-note bad">{error}</p>;
  if (!games) return <p className="jqzz-annot jqzz-shelf-empty">loading…</p>;
  if (games.length === 0) {
    return (
      <p className="jqzz-shelf-empty">
        no games yet. games you host or play land here once they finish. <a href="#/join">join one</a>
      </p>
    );
  }
  return (
    <ul className="jqzz-shelf-list">
      {games.map((g, i) => (
        <li key={g.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
          <a className="jqzz-shelf-row jqzz-game-row" href={`#/history/${g.id}`}>
            <span className={`jqzz-game-place${g.you?.ranking === 1 ? " first" : ""}`}>
              {g.you ? `#${g.you.ranking}` : "host"}
            </span>
            <span className="jqzz-shelf-body">
              <span className="jqzz-shelf-title">{g.quizName || "untitled quiz"}</span>
              <span className="jqzz-annot">
                {when(g.finishedAt)} · {plural(g.playerCount, "player")}
                {g.you && ` · ${g.you.score} pts`}
              </span>
              <span className="jqzz-game-podium">
                {g.podium.slice(0, 3).map((p) => (
                  <span key={p.userId} className={p.userId === me ? "me" : undefined}>
                    {p.ranking}. {p.name}
                  </span>
                ))}
              </span>
            </span>
            <span className="jqzz-game-go" aria-hidden="true">
              →
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
};

const GameDetail: React.FC<{ id: number; me: string }> = ({ id, me }) => {
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    historyService
      .get(me, id)
      .then((r) => !cancelled && setRecord(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [me, id]);

  if (error) return <p className="jqzz-play-note bad">{error}</p>;
  if (!record) return <p className="jqzz-annot jqzz-shelf-empty">loading…</p>;
  return (
    <div className="jqzz-game">
      <h1 className="jqzz-stage-title OEF jqzz-chroma">{record.quizName || "untitled quiz"}</h1>
      <p className="jqzz-annot">
        {when(record.finishedAt)} · {record.hosted ? "you hosted" : `you came #${record.you?.ranking}`} · code{" "}
        {record.code}
      </p>
      <ol className="jqzz-board">
        {record.players.map((p, i) => (
          <li
            key={p.userId}
            className={`jqzz-board-row${p.userId === me ? " me" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="jqzz-board-rank">{p.ranking}</span>
            <span className="jqzz-board-name">{p.name}</span>
            <span className="jqzz-board-score">{p.score}</span>
          </li>
        ))}
      </ol>
      <SaveFromGame recordId={record.id} me={me} record={record} />
    </div>
  );
};
