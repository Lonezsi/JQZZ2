import React from "react";
import type { GameBracket, GameMatch, GameState } from "../../types/play";
import { TIERS } from "../../types/play";
import type { MyAnswer } from "./Answering";
import { boardOutcome, nameOf, tileColour, tileLetter } from "../../utils/play";
import { AnswerPicture, PlayerFace } from "./PlayCommon";
import { modeOf } from "../../utils/questionTypes";
import { MatchReveal, NumberReveal, OrderReveal, TypedReveal } from "./Recall";
import { BoardNotes, ChainsReveal, DrawnReveal, EntryFace, Subject } from "./Drawn";

/** What happened on the current question, for whichever type it is. `room`: on the big screen, where nobody has points to wait for. */
export const Reveal: React.FC<{
  game: GameState;
  mine?: MyAnswer;
  me?: string;
  serverNow?: () => number;
  controls?: boolean;
  room?: boolean;
}> = ({ game, mine, me, serverNow, controls, room }) => {
  const q = game.question;
  const r = game.reveal;
  if (!q || !r) return null;
  const { ask, score } = modeOf(q);
  if (r.bracket && score === "knockout") return <BracketReveal game={game} bracket={r.bracket} />;
  // things players wrote with secret words show like drawings: each with its word and the guesses
  if (ask === "write" && score === "secret") return <DrawnReveal game={game} me={me} room={room} />;
  switch (ask) {
    case "pick":
      // a pick on earlier answers reveals them as a board, like the question they came from
      if (r.entries) {
        return r.entries.some((e) => e.image) ? <DrawnReveal game={game} me={me} room={room} /> : <EntriesReveal game={game} room={room} />;
      }
      return <ChoiceReveal game={game} mine={mine} />;
    case "pick-many":
      return <ChoiceReveal game={game} mine={mine} />;
    case "person":
      return <PersonReveal game={game} mine={mine} me={me} />;
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
      return <DrawnReveal game={game} me={me} room={room} />;
    case "chain":
      return <ChainsReveal game={game} serverNow={serverNow ?? Date.now} controls={controls} />;
    default:
      return <EntriesReveal game={game} room={room} />;
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
            {/* how many picked it, and what it was worth (before any speed bonus) */}
            <span className="jqzz-tile-count">
              {n} <small>picked</small>
              {a.value ? <small> · worth {a.value}</small> : null}
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

const EntriesReveal: React.FC<{ game: GameState; room?: boolean }> = ({ game, room }) => {
  const { entries, sorted, scored, isWinner, count } = boardOutcome(game);
  if (entries.length === 0) {
    return <p className="jqzz-play-note">{modeOf(game.question).ask === "pick" ? "nothing came in to vote on." : "nobody wrote anything."}</p>;
  }
  return (
    <>
      <div className="jqzz-entry-grid wall">
        {sorted.map((e, i) => (
          <div key={e.key} className={`jqzz-entry static${isWinner(e) ? " winner" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <span className="jqzz-entry-text">{e.text}</span>
            <Subject about={e.about} />
            {(e.authorId || scored) && (
              <span className="jqzz-entry-meta">
                {e.authorId && <span>{nameOf(game, e.authorId)}</span>}
                {scored && <span className="jqzz-annot">{count(e)}</span>}
              </span>
            )}
          </div>
        ))}
      </div>
      <BoardNotes game={game} room={room} />
    </>
  );
};

/** Who got picked: for "who was it", who it really was and who saw it coming. */
const PersonReveal: React.FC<{ game: GameState; mine?: MyAnswer; me?: string }> = ({ game, mine, me }) => {
  const r = game.reveal!;
  const right = modeOf(game.question).score === "right";
  const named = Object.entries(r.named ?? {}).sort((a, b) => b[1] - a[1]);
  const said = mine?.person;
  const chips = named.length > 0 && (
    <div className="jqzz-guess-names">
      {named.map(([id, n]) => (
        <span key={id} className={`jqzz-chip${right && id === r.author ? " agreed" : ""}`}>
          {nameOf(game, id)} · {n}
        </span>
      ))}
    </div>
  );
  const yourPick = said && <p className="jqzz-play-note">you said {nameOf(game, said)}</p>;

  if (!right) {
    const most = named.length ? named[0][1] : 0;
    const top = named.filter(([, n]) => n === most).map(([id]) => nameOf(game, id));
    return (
      <div className="jqzz-it-was">
        {top.length > 0 && <p className="jqzz-play-prompt">most picked: {top.join(", ")}</p>}
        {chips}
        {yourPick}
      </div>
    );
  }
  if (!r.settled) return null;
  if (!r.author) {
    return (
      <div className="jqzz-it-was">
        <p className="jqzz-play-prompt">nobody's answer won, so there's no one to guess.</p>
      </div>
    );
  }
  const who = game.players.find((p) => p.id === r.author);
  // everyone who named someone, and how many of them named the one it was
  const guessed = r.named?.[r.author] ?? 0;
  const guessers = named.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="jqzz-it-was">
      {who && <PlayerFace player={who} viewerId={me} className="jqzz-play-face huge" />}
      <p className="jqzz-play-prompt">it was {nameOf(game, r.author)}</p>
      {r.author === me && (
        <p className="jqzz-play-note">
          it was you. {guessed} of {guessers} guessed it.
        </p>
      )}
      {chips}
      {r.author !== me && yourPick}
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
