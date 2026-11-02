import React, { useEffect, useRef, useState } from "react";
import type { GameChain, GameEntry, GameSide, GameState, GameTask } from "../../types/play";
import { artUrl, playService, type Submission } from "../../services/playService";
import { DrawingFrame } from "../../draw/DrawingFrame";
import type { MyAnswer } from "./Answering";
import { Countdown } from "./PlayCommon";
import { nameOf } from "../../utils/play";
import { modeOf } from "../../utils/questionTypes";

/*
 * The drawn types on the phone and on the big screen: drawing (with a
 * secret word for draw + guess), telephone's turns, judging drawings, and
 * showing them all, chains included.
 */

/** an entry's face: its words, or its picture */
export const EntryFace: React.FC<{ game: GameState; e: GameSide | GameEntry; className?: string }> = ({ game, e, className }) =>
  e.image ? (
    <img className={`jqzz-art${className ? ` ${className}` : ""}`} src={artUrl(game.code, e.image)} alt="a drawing" loading="lazy" draggable={false} />
  ) : (
    <span className={`jqzz-entry-text${className ? ` ${className}` : ""}`}>{e.text}</span>
  );

/** what only this player sees: fetched again whenever the question or the round changes */
function useTask(game: GameState, me: string, wanted: boolean) {
  const [task, setTask] = useState<GameTask | null>(null);
  const q = game.question?.id;
  const round = game.telephone?.round ?? 0;
  useEffect(() => {
    if (!wanted || !me) return;
    let gone = false;
    playService
      .task(game.code, me)
      .then((t) => !gone && setTask(t))
      .catch(() => !gone && setTask({}));
    return () => {
      gone = true;
    };
  }, [game.code, me, q, round, wanted]);
  // a task from another question or turn is no task at all (an empty one is just nothing to do)
  const stale =
    !!task &&
    task.question !== undefined &&
    (task.question !== q || (!!game.telephone && task.round !== undefined && task.round !== round));
  return stale ? null : task;
}

// ─── drawing an answer ──────────────────────────────────────────────

export const DrawAnswer: React.FC<{
  game: GameState;
  me: string;
  mine: MyAnswer;
  draw: (picture: Blob) => Promise<string | null>;
  remember: (patch: MyAnswer) => void;
  serverNow: () => number;
}> = ({ game, me, draw, remember, serverNow }) => {
  const q = game.question!;
  const task = useTask(game, me, true);
  const guessing = modeOf(q).score === "secret";
  if (!task) return <p className="jqzz-play-note">getting your sheet ready...</p>;
  return (
    <div className="jqzz-draw-answer">
      {guessing && <SecretBanner word={task.word} how="draw it so the others can guess. no letters." />}
      <DrawingFrame
        keepAs={`jqzz:draw:${game.code}:${q.id}`}
        start={task.drawing ? artUrl(game.code, task.drawing) : null}
        onSend={async (picture) => {
          const id = await draw(picture);
          if (id) remember({ drawing: id });
          return !!id;
        }}
        dueAt={game.endsAt}
        serverNow={serverNow}
      />
    </div>
  );
};

const SecretBanner: React.FC<{ word?: string | null; how: string }> = ({ word, how }) => (
  <div className="jqzz-secret" role="note">
    <span className="jqzz-annot">your secret word</span>
    <strong className="OEF">{word ?? "anything you like"}</strong>
    <span className="jqzz-annot">{how}</span>
  </div>
);

/** writing with a secret word: the word on top, the writing under it */
export const SecretWord: React.FC<{ game: GameState; me: string; children: React.ReactNode }> = ({ game, me, children }) => {
  const task = useTask(game, me, true);
  if (!task) return <p className="jqzz-play-note">getting your word...</p>;
  return (
    <>
      <SecretBanner word={task.word} how="describe it so the others can guess it, without saying it." />
      {children}
    </>
  );
};

// ─── telephone ──────────────────────────────────────────────────────

export const TelephoneTurn: React.FC<{
  game: GameState;
  me: string;
  draw: (picture: Blob) => Promise<string | null>;
  submit: (a: Submission) => Promise<boolean>;
  serverNow: () => number;
}> = ({ game, me, draw, submit, serverNow }) => {
  const tel = game.telephone;
  const q = game.question!;
  const task = useTask(game, me, !!tel);
  if (!tel) return <p className="jqzz-play-note">handing out the first turn...</p>;
  if (!task) return <p className="jqzz-play-note">passing it along...</p>;
  if (task.kind === "watch" || !task.kind) {
    return <p className="jqzz-play-note">this one started before you got here. watch the chains when it's done.</p>;
  }
  const done = (game.answered ?? []).includes(me);
  const head = (
    <div className="jqzz-turn-head">
      <span className="jqzz-annot">
        turn {tel.round} of {tel.rounds} · {tel.kind === "write" ? "write" : tel.kind === "draw" ? "draw" : "describe"}
      </span>
      {tel.roundEndsAt && (
        <Countdown
          game={game}
          serverNow={serverNow}
          size={44}
          endsAt={tel.roundEndsAt}
          seconds={tel.roundSeconds}
        />
      )}
    </div>
  );
  const key = `${q.id}:${tel.round}`;

  if (task.kind === "draw") {
    return (
      <div className="jqzz-turn" key={key}>
        {head}
        <div className="jqzz-handed">
          <span className="jqzz-annot">draw this</span>
          <p className="jqzz-handed-text">“{task.handed?.text ?? "anything at all"}”</p>
        </div>
        <DrawingFrame
          keepAs={`jqzz:tel:${game.code}:${key}`}
          start={task.mine?.image ? artUrl(game.code, task.mine.image) : null}
          onSend={async (picture) => !!(await draw(picture))}
          sendLabel="pass it on"
          dueAt={tel.roundEndsAt}
          serverNow={serverNow}
        />
      </div>
    );
  }

  return (
    <div className="jqzz-turn" key={key}>
      {head}
      {task.kind === "describe" && (
        <div className="jqzz-handed">
          <span className="jqzz-annot">what is this?</span>
          {task.handed?.image ? (
            <img className="jqzz-art handed" src={artUrl(game.code, task.handed.image)} alt="the drawing you were handed" />
          ) : (
            <p className="jqzz-handed-text">“{task.handed?.text}”</p>
          )}
        </div>
      )}
      <TurnText
        key={key}
        sent={task.mine?.text}
        placeholder={task.kind === "write" ? q.text || "write something for someone to draw" : "describe the drawing"}
        dueAt={tel.roundEndsAt}
        serverNow={serverNow}
        submit={submit}
      />
      {done && <p className="jqzz-play-note">passed on. you can still change it until the turn ends.</p>}
    </div>
  );
};

/** writing a turn; whatever's typed goes by itself just before the turn ends */
const TurnText: React.FC<{
  sent?: string;
  placeholder: string;
  dueAt: number | null;
  serverNow: () => number;
  submit: (a: Submission) => Promise<boolean>;
}> = ({ sent, placeholder, dueAt, serverNow, submit }) => {
  const [text, setText] = useState(sent ?? "");
  const [last, setLast] = useState(sent ?? "");
  const draft = useRef(text);
  draft.current = text;
  const lastRef = useRef(last);
  lastRef.current = last;

  const send = async (value = text) => {
    const clean = value.trim();
    if (!clean || clean === lastRef.current) return;
    if (await submit({ text: clean })) setLast(clean);
  };

  useEffect(() => {
    if (!dueAt) return;
    const t = window.setTimeout(() => send(draft.current), Math.max(0, dueAt - serverNow() - 1400));
    return () => window.clearTimeout(t);
    // the timer is set once per turn; send reads the latest draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueAt, serverNow]);

  return (
    <div className="jqzz-written">
      <textarea
        className="jqzz-play-input"
        value={text}
        maxLength={200}
        rows={3}
        autoFocus
        placeholder={placeholder}
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
        <button className="jqzz-play-btn primary" disabled={!text.trim() || text.trim() === last} onClick={() => send()}>
          {last && text.trim() === last ? "passed on" : "pass it on"}
        </button>
      </div>
    </div>
  );
};

// ─── judging drawings ───────────────────────────────────────────────

/** draw + guess: type what you think each drawing is */
export const GuessWords: React.FC<{
  game: GameState;
  entries: GameEntry[];
  mine: MyAnswer;
  vote: (v: { guesses: Record<string, string> }) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
}> = ({ game, entries, mine, vote, remember }) => {
  const guesses = mine.guesses ?? {};
  const [drafts, setDrafts] = useState<Record<string, string>>(guesses);
  const send = async (key: string) => {
    const word = (drafts[key] ?? "").trim();
    if (!word) return;
    if (await vote({ guesses: { [key]: word } })) remember({ guesses: { ...guesses, [key]: word } });
  };
  if (!entries.length) return <p className="jqzz-play-note">only your own drawing is up. sit this one out.</p>;
  return (
    <div className="jqzz-judging">
      <p className="jqzz-play-prompt small">{entries.some((e) => e.image) ? "what's each one a drawing of?" : "what's each one describing?"}</p>
      <div className="jqzz-guess-grid">
        {entries.map((e) => (
          <form
            key={e.key}
            className={`jqzz-guess-card${guesses[e.key] ? " sent" : ""}`}
            onSubmit={(ev) => {
              ev.preventDefault();
              send(e.key);
            }}
          >
            <EntryFace game={game} e={e} />
            <div className="jqzz-guess-row">
              <input
                className="jqzz-play-input"
                value={drafts[e.key] ?? ""}
                maxLength={60}
                autoComplete="off"
                placeholder="it's a..."
                onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
              />
              <button className="jqzz-play-btn small" disabled={!(drafts[e.key] ?? "").trim() || drafts[e.key]?.trim() === guesses[e.key]}>
                {guesses[e.key] && drafts[e.key]?.trim() === guesses[e.key] ? "✓" : "guess"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
};

// ─── showing them ───────────────────────────────────────────────────

/** every drawing on the wall; once the voting or guessing is over, who drew what and how it went */
export const DrawnReveal: React.FC<{ game: GameState; me?: string }> = ({ game, me }) => {
  const r = game.reveal!;
  const entries = r.entries ?? [];
  if (!entries.length) return <p className="jqzz-play-note">nobody drew anything.</p>;
  const { score } = modeOf(game.question);
  const scored = r.settled && score !== "none";
  const top = Math.max(0, ...entries.map((e) => e.votes ?? 0));
  const sorted = scored ? [...entries].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : entries;
  return (
    <div className="jqzz-gallery">
      {sorted.map((e, i) => (
        <figure
          key={e.key}
          className={`jqzz-frame${scored && top > 0 && e.votes === top ? " winner" : ""}${e.authorId === me ? " mine" : ""}`}
          style={{ "--i": i } as React.CSSProperties}
        >
          <EntryFace game={game} e={e} />
          {(e.authorId || scored) && (
            <figcaption>
              {e.word && <strong className="jqzz-frame-word">{e.word}</strong>}
              {e.authorId && <span>{nameOf(game, e.authorId)}</span>}
              {scored && (
                <span className="jqzz-annot">
                  {score === "secret" ? `${e.votes ?? 0} got it` : score === "authors" ? `${e.votes ?? 0} saw through it` : `${e.votes ?? 0} votes`}
                </span>
              )}
              {e.guesses && e.guesses.length > 0 && (
                <span className="jqzz-frame-guesses">
                  {e.guesses.map((g) => (
                    <span key={g.userId} className={g.right ? "right" : undefined} title={nameOf(game, g.userId)}>
                      {g.text}
                    </span>
                  ))}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
};

/**
 * The telephone chains, one at a time, everyone on the same one: the reveal's
 * time is split between the chains, and each chain's links come in one after
 * another, the way the story got told. A phone can step through them too.
 */
export const ChainsReveal: React.FC<{ game: GameState; serverNow: () => number; controls?: boolean }> = ({ game, serverNow, controls }) => {
  const chains = (game.reveal?.chains ?? []).filter((c) => c.links.length > 0);
  const [now, setNow] = useState(() => serverNow());
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(serverNow()), 250);
    return () => window.clearInterval(t);
  }, [serverNow]);
  if (!chains.length) return <p className="jqzz-play-note">nothing got handed on.</p>;

  const total = Math.max(1, (game.seconds ?? 30) * 1000);
  const left = game.endsAt ? Math.max(0, game.endsAt - now) : game.pausedLeft ?? 0;
  const elapsed = Math.min(total, total - left);
  const per = total / chains.length;
  const auto = Math.min(chains.length - 1, Math.floor(elapsed / per));
  const index = picked ?? auto;
  const chain: GameChain = chains[index];
  // links come in one by one through the chain's share of the time; a chain you picked is shown whole
  const into = elapsed - auto * per;
  const shown = picked !== null || index !== auto ? chain.links.length : Math.min(chain.links.length, 1 + Math.floor((into / per) * (chain.links.length + 0.6)));

  return (
    <div className="jqzz-chains">
      <div className="jqzz-chains-head">
        <span className="jqzz-annot">
          chain {index + 1} of {chains.length} · started by {nameOf(game, chain.starter)}
        </span>
        {controls && chains.length > 1 && (
          <span className="jqzz-chains-nav">
            <button className="jqzz-play-btn small ghost" onClick={() => setPicked(Math.max(0, index - 1))} disabled={index === 0}>
              ‹
            </button>
            {picked !== null && (
              <button className="jqzz-play-btn small ghost" onClick={() => setPicked(null)}>
                follow along
              </button>
            )}
            <button className="jqzz-play-btn small ghost" onClick={() => setPicked(Math.min(chains.length - 1, index + 1))} disabled={index === chains.length - 1}>
              ›
            </button>
          </span>
        )}
      </div>
      <ol className="jqzz-chain" key={index}>
        {chain.links.slice(0, shown).map((l, i) => (
          <li key={i} className={`jqzz-link${l.image ? " drawn" : " said"}`} style={{ "--i": i } as React.CSSProperties}>
            <span className="jqzz-link-who jqzz-annot">
              {nameOf(game, l.authorId)} {i === 0 ? "wrote" : l.image ? "drew" : "thought it was"}
            </span>
            {l.image ? (
              <img className="jqzz-art" src={artUrl(game.code, l.image)} alt={`drawn by ${nameOf(game, l.authorId)}`} />
            ) : (
              <p className="jqzz-link-text">“{l.text}”</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
