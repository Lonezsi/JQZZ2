import React from "react";
import type { GameBracket, GameMatch, GameState } from "../../types/play";
import { TIERS } from "../../types/play";
import type { MyAnswer } from "./Answering";
import { nameOf, tileColour, tileLetter } from "../../utils/play";
import { AnswerPicture } from "./PlayCommon";
import { modeOf } from "../../utils/questionTypes";
import { MatchReveal, NumberReveal, OrderReveal, TypedReveal } from "./Recall";
import { ChainsReveal, DrawnReveal, EntryFace } from "./Drawn";

/** What happened on the current question, for whichever type it is. */
export const Reveal: React.FC<{ game: GameState; mine?: MyAnswer; me?: string; serverNow?: () => number; controls?: boolean }> = ({
  game,
  mine,
  me,
  serverNow,
  controls,
}) => {
  const q = game.question;
  const r = game.reveal;
  if (!q || !r) return null;
  const { ask, score } = modeOf(q);
  if (r.bracket && score === "knockout") return <BracketReveal game={game} bracket={r.bracket} />;
  // things players wrote with secret words show like drawings: each with its word and the guesses
  if (ask === "write" && score === "secret") return <DrawnReveal game={game} me={me} />;
  switch (ask) {
    case "pick":
    case "pick-many":
      return <ChoiceReveal game={game} mine={mine} />;
    case "rank":
      return <TierReveal game={game} mine={mine} />;
    case "type-in":
      return <TypedReveal game={game} mine={mine} />;
    case "order":
      return <OrderReveal game={game} mine={mine} />;
    case "number":
      return <NumberReveal game={game} me={me} />;
    case "match":
      return <MatchReveal game={game} mine={mine} />;
    case "draw":
      return <DrawnReveal game={game} me={me} />;
    case "chain":
      return <ChainsReveal game={game} serverNow={serverNow ?? Date.now} controls={controls} />;
    default:
      return <EntriesReveal game={game} />;
  }
};

const ChoiceReveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question!;
  const counts = game.reveal?.counts ?? {};
  const correct = new Set(game.reveal?.correct ?? []);
  const most = Math.max(1, ...Object.values(counts));
  return (
    <div className="jqzz-tiles revealed">
      {q.answers.map((a, i) => {
        const n = counts[a.id] ?? 0;
        const right = correct.has(a.id);
        const picked = mine?.picks?.includes(a.id);
        return (
          <div
            key={a.id}
            className={`jqzz-tile${right ? " right" : " wrong"}${picked ? " picked" : ""}`}
            style={{ "--tile": tileColour(i), "--share": n / most } as React.CSSProperties}
          >
            <span className="jqzz-tile-bar" aria-hidden="true" />
            <AnswerPicture src={a.imageUrl} game={game} />
            <span className="jqzz-tile-letter">{right ? "✓" : tileLetter(i)}</span>
            <span className="jqzz-tile-text">{a.text || "..."}</span>
            <span className="jqzz-tile-count">
              {n}
              {a.value ? <small> · {a.value} pts</small> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const TierReveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question!;
  const consensus = game.reveal?.consensus ?? {};
  const unplaced = q.answers.filter((a) => !consensus[a.id]);
  return (
    <div className="jqzz-tierlist">
      {TIERS.map((t) => (
        <div key={t} className={`jqzz-tier-row tier-${t}`}>
          <span className="jqzz-tier-label OEF">{t}</span>
          <div className="jqzz-tier-items">
            {q.answers
              .filter((a) => consensus[a.id] === t)
              .map((a) => (
                <span
                  key={a.id}
                  className={`jqzz-chip${mine?.tiers?.[a.id] === t ? " agreed" : ""}`}
                  title={mine?.tiers?.[a.id] ? `you said ${mine.tiers[a.id]}` : undefined}
                >
                  {a.text}
                </span>
              ))}
          </div>
        </div>
      ))}
      {unplaced.length > 0 && (
        <p className="jqzz-play-note">nobody ranked: {unplaced.map((a) => a.text).join(", ")}</p>
      )}
    </div>
  );
};

const EntriesReveal: React.FC<{ game: GameState }> = ({ game }) => {
  const r = game.reveal!;
  const entries = r.entries ?? [];
  if (entries.length === 0) return <p className="jqzz-play-note">nobody wrote anything.</p>;
  const top = Math.max(0, ...entries.map((e) => e.votes ?? 0));
  const { score } = modeOf(game.question);
  const scored = r.settled && score !== "none";
  const sorted = scored ? [...entries].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : entries;
  return (
    <div className="jqzz-entry-grid wall">
      {sorted.map((e, i) => (
        <div
          key={e.key}
          className={`jqzz-entry static${scored && top > 0 && e.votes === top ? " winner" : ""}`}
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="jqzz-entry-text">{e.text}</span>
          {(e.authorId || scored) && (
            <span className="jqzz-entry-meta">
              {e.authorId && <span>{nameOf(game, e.authorId)}</span>}
              {scored && (
                <span className="jqzz-annot">
                  {e.votes ?? 0} {score === "authors" ? "saw through it" : "votes"}
                </span>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const MatchCard: React.FC<{ game: GameState; m: GameMatch }> = ({ game, m }) => {
  const sides = [
    { side: m.a, votes: m.votesA, author: m.authorA },
    ...(m.b ? [{ side: m.b, votes: m.votesB, author: m.authorB ?? undefined }] : []),
  ];
  return (
    <div className={`jqzz-match${m.b ? "" : " bye"}`}>
      {sides.map(({ side, votes, author }) => (
        <div key={side.key} className={`jqzz-match-side${m.winner === side.key ? " won" : m.winner ? " lost" : ""}`}>
          <EntryFace game={game} e={side} />
          {votes !== undefined && (
            <span className="jqzz-annot">
              {votes} · {nameOf(game, author)}
            </span>
          )}
        </div>
      ))}
      {!m.b && <span className="jqzz-annot">goes through</span>}
    </div>
  );
};

const BracketReveal: React.FC<{ game: GameState; bracket: GameBracket }> = ({ game, bracket }) => (
  <div className="jqzz-bracket">
    {bracket.champion && (
      <div className="jqzz-champion">
        <span className="jqzz-annot">champion</span>
        {bracket.champion.image ? (
          <EntryFace game={game} e={bracket.champion} className="champion" />
        ) : (
          <p className="jqzz-champion-text">“{bracket.champion.text}”</p>
        )}
        <span>{nameOf(game, bracket.champion.authorId)}</span>
      </div>
    )}
    {!bracket.done && (
      <>
        <span className="jqzz-annot">
          round {bracket.round} of {bracket.rounds}
        </span>
        <div className="jqzz-match-list">
          {bracket.matches.map((m) => (
            <MatchCard key={m.id} game={game} m={m} />
          ))}
        </div>
      </>
    )}
    {bracket.history.length > 0 && (
      <details className="jqzz-bracket-history" open={bracket.done}>
        <summary className="jqzz-annot">earlier rounds</summary>
        {bracket.history.map((round, i) => (
          <div key={i} className="jqzz-match-list">
            {round.map((m) => (
              <MatchCard key={m.id} game={game} m={m} />
            ))}
          </div>
        ))}
      </details>
    )}
  </div>
);
