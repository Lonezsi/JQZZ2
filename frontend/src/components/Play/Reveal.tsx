import React from "react";
import type { GameBracket, GameMatch, GameState } from "../../types/play";
import { TIERS } from "../../types/play";
import type { MyAnswer } from "./Answering";
import { nameOf, tileColour, tileLetter } from "../../utils/play";
import { AnswerPicture } from "./PlayCommon";

/** What happened on the current question, for whichever type it is. */
export const Reveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question;
  const r = game.reveal;
  if (!q || !r) return null;
  if (q.type === "PREWRITTEN_SINGLE" || q.type === "PREWRITTEN_MULTIPLE") {
    return <ChoiceReveal game={game} mine={mine} />;
  }
  if (q.type === "TIERLIST") return <TierReveal game={game} mine={mine} />;
  if (q.type === "KNOCKOUT_BATTLE" && r.bracket) return <BracketReveal game={game} bracket={r.bracket} />;
  return <EntriesReveal game={game} />;
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
            <span className="jqzz-tile-text">{a.text || "…"}</span>
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
  const scored = r.settled && game.question?.type !== "USER_GENERATED";
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
                  {e.votes ?? 0} {game.question?.type === "USER_GENERATED_IDENTIFY" ? "saw through it" : "votes"}
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
          <span className="jqzz-entry-text">{side.text}</span>
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
        <p className="jqzz-champion-text">“{bracket.champion.text}”</p>
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
