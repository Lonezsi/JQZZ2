import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { go } from "../../hooks/useHashRoute";
import { errorMessage } from "../../services/api";
import { historyService, stashService } from "../../services/stashService";
import { keptArtUrl, playService } from "../../services/playService";
import type { HistoryRecord, HistorySummary, QuestionResult, StashedQuestion } from "../../types/stash";
import { PlayFrame } from "../Play/PlayCommon";
import { BackButton } from "../common/BackButton";
import { Glyph } from "../common/Glyph";
import { Loading } from "../common/Loading";
import { plural, when } from "../../utils/format";
import { typeIcon, typeLabel } from "../../utils/questionInfo";

/**
 * Games as a timeline, newest on top: where you (or whoever's profile it is)
 * placed, how many played, who made the podium.
 */
export const GameList: React.FC<{
  games: HistorySummary[];
  me: string;
  empty: React.ReactNode;
  /** the list is filtered by a search: empty means no match */
  searching?: boolean;
}> = ({ games, me, empty, searching = false }) => {
  if (games.length === 0)
    return <p className="jqzz-shelf-empty">{searching ? "no game matches that: try a quiz or a player's name." : empty}</p>;
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
          {!record && !error && <Loading label="loading the game" />}
          {record && (
            <div className="jqzz-game">
              <h1 className="jqzz-stage-title OEF jqzz-chroma">{record.quizName || "untitled quiz"}</h1>
              <p className="jqzz-annot">
                {when(record.finishedAt)} ·{" "}
                {record.hosted ? "you hosted" : `you came #${record.you?.ranking}`} · code {record.code}
              </p>
              <div className="jqzz-play-row">
                <button
                  className="jqzz-play-btn primary"
                  onClick={rematch}
                  disabled={busy || !record.quizId}
                  title="hosts it again and invites everyone who was in it"
                >
                  <Glyph name="RESET" size={14} />
                  {busy ? "starting..." : "rematch"}
                </button>
                <SaveButton
                  icon="QUIZ"
                  label="save the quiz"
                  done="quiz saved"
                  run={() => stashService.fromGame(me, record.id)}
                />
              </div>
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
  const questions = record.content.questions;
  if (questions.length === 0) return null;
  return (
    <section className="jqzz-answers" aria-label="The questions, and what everyone answered">
      <h2 className="jqzz-annot">the questions · what everyone answered</h2>
      <ol>
        {questions.map((q, i) => {
          const r = results[String(q.key)];
          const gain = r?.gains?.[me];
          return (
            <li key={q.key} className="jqzz-answer-card" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <div className="jqzz-answer-head">
                <span className="jqzz-answer-tile" aria-hidden="true">
                  <Glyph name={typeIcon(q)} size={16} />
                </span>
                <span className="jqzz-keep-text">
                  <span className="jqzz-answer-q">
                    <span className="jqzz-annot">{i + 1}</span> {q.text || "untitled question"}
                  </span>
                  <span className="jqzz-annot">
                    {typeLabel(q)}
                    {gain ? <b className="jqzz-board-gain"> +{gain}</b> : null}
                  </span>
                </span>
                <span className="jqzz-answer-actions">
                  <SaveButton
                    small
                    icon="ITEM_QUESTION"
                    label="save"
                    done="saved"
                    title="this question, words and all"
                    run={() => stashService.fromGame(me, record.id, q.key)}
                  />
                  <SaveButton
                    small
                    icon="TYPE"
                    label="save as type"
                    done="type saved"
                    title="its type and phases, without the words, for new questions"
                    run={() =>
                      stashService.asType(
                        me,
                        { recordId: record.id, questionKey: q.key },
                        `${typeLabel(q)}: ${q.text || "question"}`.slice(0, 60),
                      )
                    }
                  />
                </span>
              </div>
              {r && Object.keys(r).length > 0 ? (
                <Result q={q} r={r} recordId={record.id} />
              ) : (
                <p className="jqzz-annot">the game ended before this one</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/** a drawing kept with the game */
const Kept: React.FC<{ recordId: number; id: string; alt: string }> = ({ recordId, id, alt }) => (
  <img className="jqzz-art" src={keptArtUrl(recordId, id)} alt={alt} loading="lazy" />
);

const Result: React.FC<{ q: StashedQuestion; r: QuestionResult; recordId: number }> = ({ q, r, recordId }) => {
  if (r.chains) {
    const chains = r.chains.filter((c) => c.links.length > 0);
    if (chains.length === 0) return <p className="jqzz-annot">nothing got handed on</p>;
    return (
      <div className="jqzz-chains-recap">
        {chains.map((c, i) => (
          <ol key={i} className="jqzz-chain">
            {c.links.map((l, j) => (
              <li key={j} className={`jqzz-link${l.image ? " drawn" : " said"}`}>
                <span className="jqzz-link-who jqzz-annot">{l.by}</span>
                {l.image ? <Kept recordId={recordId} id={l.image} alt={`drawn by ${l.by}`} /> : <p className="jqzz-link-text">“{l.text}”</p>}
              </li>
            ))}
          </ol>
        ))}
      </div>
    );
  }
  if (r.typed) {
    return (
      <ul className="jqzz-typed-list">
        {r.typed.map((t) => (
          <li key={t.text} className={t.right ? "right" : "wrong"}>
            <span>{t.text}</span>
            <span className="jqzz-annot">×{t.count}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (r.numbers) {
    const right = Number(q.answers[0]?.text);
    return (
      <ul className="jqzz-entries-recap">
        <li>
          <span className="jqzz-entry-text">the answer: {q.answers[0]?.text}</span>
        </li>
        {[...r.numbers]
          .sort((a, b) => (Number.isFinite(right) ? Math.abs(a.value - right) - Math.abs(b.value - right) : 0))
          .map((n, i) => (
            <li key={i}>
              <span className="jqzz-entry-text">{n.value}</span>
              <span className="jqzz-annot">{n.by}</span>
            </li>
          ))}
      </ul>
    );
  }
  if (r.right) {
    return (
      <ul className="jqzz-tier-recap">
        {q.answers.map((a, i) => (
          <li key={i}>
            <b>{r.right?.[i] ?? 0}</b>
            {a.text}
            {a.match ? ` → ${a.match}` : ""}
          </li>
        ))}
      </ul>
    );
  }
  if (r.counts) {
    const total = Math.max(1, r.counts.reduce((a, b) => a + b, 0));
    return (
      <ul className="jqzz-bars">
        {q.answers.map((a, i) => (
          <li key={i} className={a.value > 0 ? "right" : undefined}>
            <span className="jqzz-bars-text">{a.text || "..."}</span>
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
            won: {r.champion.image ? "" : <b>{r.champion.text}</b>} by {r.champion.by}
          </p>
        )}
        {r.entries.some((e) => e.image) ? (
          <div className="jqzz-gallery">
            {[...r.entries]
              .sort((a, b) => b.votes - a.votes)
              .map((e, i) => (
                <figure key={i} className="jqzz-frame">
                  {e.image && <Kept recordId={recordId} id={e.image} alt={`drawn by ${e.by}`} />}
                  <figcaption>
                    {e.word && <strong className="jqzz-frame-word">{e.word}</strong>}
                    <span>{e.by}</span>
                    {e.votes > 0 && <span className="jqzz-annot">{e.votes}</span>}
                  </figcaption>
                </figure>
              ))}
          </div>
        ) : (
          <ul className="jqzz-entries-recap">
            {[...r.entries]
              .sort((a, b) => b.votes - a.votes)
              .map((e, i) => (
                <li key={i}>
                  <span className="jqzz-entry-text">
                    “{e.text}”{e.word ? <b> · {e.word}</b> : null}
                  </span>
                  <span className="jqzz-annot">
                    {e.by}
                    {e.votes > 0 && ` · ${e.votes}`}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </>
    );
  }
  return null;
};

/** A button that saves something once, then says so. */
const SaveButton: React.FC<{
  icon: string;
  label: string;
  done: string;
  title?: string;
  small?: boolean;
  run: () => Promise<unknown>;
}> = ({ icon, label, done, title, small, run }) => {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      className={`jqzz-play-btn${small ? " small ghost" : ""}${state === "done" ? " is-done" : ""}`}
      title={error ?? title}
      disabled={state === "busy" || state === "done"}
      onClick={() => {
        setState("busy");
        run()
          .then(() => setState("done"))
          .catch((err) => {
            setError(errorMessage(err));
            setState("error");
          });
      }}
    >
      <Glyph name={state === "done" ? "ANSWER" : icon} size={small ? 13 : 14} />
      {state === "busy" ? "saving..." : state === "done" ? done : state === "error" ? "try again" : label}
    </button>
  );
};
