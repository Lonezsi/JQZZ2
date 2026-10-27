import React, { useState } from "react";
import type { GameEntry, GameState } from "../../types/play";
import { TIERS } from "../../types/play";
import { QuestionImage } from "./PlayCommon";
import { nameOf, tileColour, tileLetter } from "../../utils/play";

/** What this player sent for a question, remembered on their own device. */
export interface MyAnswer {
  picks?: number[];
  text?: string;
  tiers?: Record<number, string>;
  vote?: string;
  guesses?: Record<string, string>;
  battles?: Record<number, string>;
}

interface Props {
  game: GameState;
  me: string;
  mine: MyAnswer;
  /** send an answer; resolves true when the server took it */
  submit: (answer: { picks?: number[]; text?: string; tiers?: Record<number, string> }) => Promise<boolean>;
  vote: (v: { choice?: string; match?: number; guesses?: Record<string, string> }) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
}

/** Answering the current question, in whatever way its type asks for. */
export const Answering: React.FC<Props> = (props) => {
  const { game } = props;
  const q = game.question;
  if (!q) return null;
  const type = q.type;
  let body: React.ReactNode;
  if (type === "PREWRITTEN_SINGLE" || type === "PREWRITTEN_MULTIPLE") body = <Choice {...props} />;
  else if (type === "TIERLIST") body = <Tiers {...props} />;
  else body = <Written {...props} />;
  return (
    <div className="jqzz-answering">
      <p className="jqzz-play-prompt">{q.text}</p>
      <QuestionImage src={q.imageUrl} ownerId={game.authorId} viewerId={props.me} />
      {body}
    </div>
  );
};

const Choice: React.FC<Props> = ({ game, mine, submit, remember }) => {
  const q = game.question!;
  const multiple = q.type === "PREWRITTEN_MULTIPLE";
  const [picked, setPicked] = useState<number[]>(mine.picks ?? []);
  const sent = mine.picks ?? [];
  const same = sent.length === picked.length && sent.every((id) => picked.includes(id));

  const tap = async (id: number) => {
    if (!multiple) {
      setPicked([id]);
      if (await submit({ picks: [id] })) remember({ picks: [id] });
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <>
      <div className="jqzz-tiles">
        {q.answers.map((a, i) => (
          <button
            key={a.id}
            className={`jqzz-tile${picked.includes(a.id) ? " picked" : ""}`}
            style={{ "--tile": tileColour(i) } as React.CSSProperties}
            onClick={() => tap(a.id)}
            aria-pressed={picked.includes(a.id)}
          >
            <span className="jqzz-tile-letter">{tileLetter(i)}</span>
            <span className="jqzz-tile-text">{a.text || "…"}</span>
          </button>
        ))}
      </div>
      {multiple && (
        <button
          className="jqzz-play-btn primary"
          disabled={picked.length === 0 || same}
          onClick={async () => {
            if (await submit({ picks: picked })) remember({ picks: picked });
          }}
        >
          {sent.length && same ? "locked in" : "lock in"}
        </button>
      )}
      {!multiple && sent.length > 0 && <p className="jqzz-play-note">locked in. you can still change it.</p>}
    </>
  );
};

const Tiers: React.FC<Props> = ({ game, mine, submit, remember }) => {
  const q = game.question!;
  const [placed, setPlaced] = useState<Record<number, string>>(mine.tiers ?? {});
  const place = async (id: number, tier: string) => {
    const next = { ...placed };
    if (next[id] === tier) delete next[id];
    else next[id] = tier;
    setPlaced(next);
    // every change goes straight in, so time running out loses nothing
    if (Object.keys(next).length && (await submit({ tiers: next }))) remember({ tiers: next });
  };
  return (
    <div className="jqzz-tier-input">
      {q.answers.map((a) => (
        <div key={a.id} className="jqzz-tier-item">
          <span className="jqzz-tier-item-text">{a.text || "…"}</span>
          <div className="jqzz-tier-picks" role="group" aria-label={`Tier for ${a.text}`}>
            {TIERS.map((t) => (
              <button
                key={t}
                className={`jqzz-tier-btn tier-${t}${placed[a.id] === t ? " on" : ""}`}
                onClick={() => place(a.id, t)}
                aria-pressed={placed[a.id] === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="jqzz-play-note">
        {Object.keys(placed).length}/{q.answers.length} placed · saved as you go
      </p>
    </div>
  );
};

const Written: React.FC<Props> = ({ mine, submit, remember }) => {
  const [text, setText] = useState(mine.text ?? "");
  const [editing, setEditing] = useState(!mine.text);
  if (!editing && mine.text) {
    return (
      <div className="jqzz-written-sent">
        <span className="jqzz-annot">you wrote</span>
        <p>“{mine.text}”</p>
        <button className="jqzz-play-btn" onClick={() => setEditing(true)}>
          change it
        </button>
      </div>
    );
  }
  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    if (await submit({ text: clean })) {
      remember({ text: clean });
      setEditing(false);
    }
  };
  return (
    <div className="jqzz-written">
      <textarea
        className="jqzz-play-input"
        value={text}
        maxLength={200}
        rows={3}
        placeholder="your answer"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="jqzz-written-row">
        <span className="jqzz-annot">{text.length}/200</span>
        <button className="jqzz-play-btn primary" disabled={!text.trim()} onClick={send}>
          send
        </button>
      </div>
    </div>
  );
};

/** Voting, guessing or judging battles during the reveal. */
export const Judging: React.FC<Props> = ({ game, me, mine, vote, remember }) => {
  const entries = game.reveal?.entries ?? [];
  const isMine = (e: { text: string }) => !!mine.text && e.text === mine.text;

  if (game.interaction === "vote") {
    const others = entries.filter((e) => !isMine(e));
    return (
      <div className="jqzz-judging">
        <p className="jqzz-play-prompt small">vote for the best one</p>
        <div className="jqzz-entry-grid">
          {others.map((e) => (
            <button
              key={e.key}
              className={`jqzz-entry${mine.vote === e.key ? " picked" : ""}`}
              onClick={async () => {
                if (await vote({ choice: e.key })) remember({ vote: e.key });
              }}
            >
              {e.text}
            </button>
          ))}
        </div>
        {others.length === 0 && <p className="jqzz-play-note">nothing to vote on but your own.</p>}
      </div>
    );
  }

  if (game.interaction === "guess") {
    return <Guessing game={game} me={me} mine={mine} entries={entries.filter((e) => !isMine(e))} vote={vote} remember={remember} />;
  }

  if (game.interaction === "bracket") {
    const bracket = game.reveal?.bracket;
    if (!bracket) return null;
    return (
      <div className="jqzz-judging">
        <p className="jqzz-play-prompt small">
          round {bracket.round} of {bracket.rounds} · pick a winner in each battle
        </p>
        {bracket.matches
          .filter((m) => m.b)
          .map((m) => {
            const own = isMine(m.a) || isMine(m.b!);
            return (
              <div key={m.id} className={`jqzz-battle${own ? " own" : ""}`}>
                {[m.a, m.b!].map((side) => (
                  <button
                    key={side.key}
                    className={`jqzz-entry${mine.battles?.[m.id] === side.key ? " picked" : ""}`}
                    disabled={own}
                    onClick={async () => {
                      if (await vote({ choice: side.key, match: m.id })) {
                        remember({ battles: { ...(mine.battles ?? {}), [m.id]: side.key } });
                      }
                    }}
                  >
                    {side.text}
                  </button>
                ))}
                {own && <span className="jqzz-annot">yours is in this one</span>}
              </div>
            );
          })}
      </div>
    );
  }
  return null;
};

const Guessing: React.FC<{
  game: GameState;
  me: string;
  mine: MyAnswer;
  entries: GameEntry[];
  vote: Props["vote"];
  remember: Props["remember"];
}> = ({ game, me, mine, entries, vote, remember }) => {
  const authors = (game.reveal?.authors ?? []).filter((id) => id !== me);
  const guesses = mine.guesses ?? {};
  const pick = async (key: string, author: string) => {
    const next = { ...guesses, [key]: author };
    if (await vote({ guesses: { [key]: author } })) remember({ guesses: next });
  };
  return (
    <div className="jqzz-judging">
      <p className="jqzz-play-prompt small">who wrote each one?</p>
      {entries.map((e) => (
        <div key={e.key} className="jqzz-guess">
          <p className="jqzz-guess-text">“{e.text}”</p>
          <div className="jqzz-guess-names">
            {authors.map((id) => (
              <button
                key={id}
                className={`jqzz-chip${guesses[e.key] === id ? " picked" : ""}`}
                onClick={() => pick(e.key, id)}
              >
                {nameOf(game, id)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
