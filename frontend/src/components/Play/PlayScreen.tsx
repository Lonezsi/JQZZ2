import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGame } from "../../hooks/useGame";
import { go } from "../../hooks/useHashRoute";
import { useEscape } from "../../hooks/useEscape";
import { playService, type Submission, type Vote } from "../../services/playService";
import { describeQuestion, modeOf } from "../../utils/questionTypes";
import type { GameState } from "../../types/play";
import { IdentityModal } from "../Modals/IdentityModal";
import { usePresence } from "../../hooks/usePresence";
import { Answering, Judging } from "./Answering";
import type { MyAnswer } from "./Answering";
import { ConfirmButton, Countdown, Leaderboard, PlayerFace, PlayFrame, Podium, QuestionHead, QuestionImage } from "./PlayCommon";
import { Reveal } from "./Reveal";
import { SaveFromGame } from "../Stash/SaveFromGame";
import { BackButton } from "../common/BackButton";
import { Confetti } from "../common/Confetti";
import { errorMessage } from "../../services/api";
import { Glyph } from "../common/Glyph";
import { Doodle } from "./Doodle";
import { WhoAreYou } from "./WhoAreYou";

const STORE = (code: string) => `jqzz.mine.${code}`;

function loadMine(code: string): Record<number, MyAnswer> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE(code)) ?? "{}");
  } catch {
    return {};
  }
}

/** A player's phone: answer, vote, see how you did. */
export const PlayScreen: React.FC<{ code: string }> = ({ code }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const { game, error, setError, act, serverNow } = useGame(code);
  const [identityOpen, setIdentityOpen] = useState(false);
  // in a roster game, choosing another name off the list (lobby only)
  const [renaming, setRenaming] = useState(false);
  const identity = usePresence(identityOpen, 240);

  // what you sent, per question, kept for this tab so a reload remembers it
  const [mine, setMine] = useState<Record<number, MyAnswer>>(() => loadMine(code));
  const remember = useCallback(
    (questionId: number, patch: MyAnswer) =>
      setMine((all) => {
        const next = { ...all, [questionId]: { ...all[questionId], ...patch } };
        try {
          sessionStorage.setItem(STORE(code), JSON.stringify(next));
        } catch {
          /* private mode: it just won't survive a reload */
        }
        return next;
      }),
    [code],
  );

  // in the game? if not, join it, but only until the game says no (the host
  // took you out, or it's full): then stop asking and say why. A game with a
  // roster waits for you to pick your name instead.
  const joining = useRef(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const inGame = !!game?.players.some((p) => p.id === me);
  useEffect(() => {
    if (!game || !me || inGame || joining.current || refused || leaving || game.status === "FINISHED") return;
    if (game.roster) return;
    joining.current = true;
    playService
      .join(code, me)
      .catch((err) => setRefused(errorMessage(err)))
      .finally(() => {
        joining.current = false;
      });
  }, [game, me, inGame, code, refused, leaving]);

  const leave = () => {
    setLeaving(true);
    playService
      .leave(code, me)
      .catch(() => {})
      .finally(() => go("/"));
  };

  // Esc leaves only where there's nothing to leave: no such game, kept out of
  // it, or it's over; and it takes down a notice that's up. Never mid-game.
  useEscape(!game && !!error, () => go("/join"));
  useEscape(!!refused && !!game && !inGame, () => go("/join"));
  useEscape(game?.status === "FINISHED", () => go("/"));
  useEscape(!!game && !!error, () => setError(null));

  if (refused && game && !inGame) {
    return (
      <PlayFrame>
        <div className="jqzz-play-center">
          <p className="jqzz-play-prompt small">{refused}</p>
          <button className="jqzz-play-btn" onClick={() => go("/join")}>
            join another game
          </button>
        </div>
      </PlayFrame>
    );
  }

  if (game && game.roster && game.status !== "FINISHED" && !leaving && (!inGame || (renaming && game.status === "LOBBY"))) {
    return (
      <PlayFrame>
        <header className="jqzz-play-bar compact">
          <BackButton title="step out: pick your name when you come back" />
          <span className="jqzz-play-title">{game.quizName}</span>
        </header>
        <main className="jqzz-phone">
          <WhoAreYou
            game={game}
            me={me}
            onJoined={(state) => {
              setRenaming(false);
              act(async () => state);
            }}
            onRefused={setRefused}
            onCancel={inGame ? () => setRenaming(false) : undefined}
          />
        </main>
      </PlayFrame>
    );
  }

  if (!game) {
    return (
      <PlayFrame>
        <div className="jqzz-play-center">
          <span className="jqzz-annot">{error ?? "finding the game..."}</span>
          {error && (
            <button className="jqzz-play-btn" onClick={() => go("/join")}>
              try another code
            </button>
          )}
        </div>
      </PlayFrame>
    );
  }

  const player = game.players.find((p) => p.id === me);
  const q = game.question;
  const myAnswer = (q && mine[q.id]) || {};

  const submit = (answer: Submission) => act(() => playService.submit(code, me, answer));
  const draw = async (picture: Blob) => {
    let id: string | null = null;
    const ok = await act(async () => {
      const r = await playService.draw(code, me, picture);
      id = r.drawing;
      return r;
    });
    return ok ? id : null;
  };
  const vote = (v: Vote) => act(() => playService.vote(code, me, v));

  // done with this step: nothing left to answer or vote on
  const running = game.status === "PLAYING" || game.status === "PAUSED";
  const judging = game.interaction === "vote" || game.interaction === "guess" || game.interaction === "bracket";
  const answered =
    (game.phase === "QUESTION" && (game.answered ?? []).includes(me)) || (judging && (game.acted ?? []).includes(me));
  const owes = (game.phase === "QUESTION" || judging) && !answered;
  const done = running && !!player && !owes;
  const hurry = done && game.status === "PLAYING" && game.hostId !== me ? () => act(() => playService.hurry(code, me)) : null;

  return (
    <PlayFrame phase={game.phase}>
      <header className="jqzz-play-bar compact">
        <BackButton title="step out: you stay in the game and can come back" />
        <span className="jqzz-play-title">{game.quizName}</span>
        {player && game.status !== "LOBBY" && (
          <span className="jqzz-play-me">
            <span className="jqzz-annot">#{player.rank}</span> {player.score}
          </span>
        )}
        {player && game.status !== "FINISHED" && <LeaveButton onLeave={leave} busy={leaving} />}
      </header>
      {game.hostHere === false && game.status !== "FINISHED" && (
        <p className="jqzz-host-away" role="status">
          {game.pausedForHost
            ? "the host's screen dropped out. the game waits for it and carries on when it's back."
            : game.status === "LOBBY"
              ? "the host isn't on the game screen right now. it starts when they're back."
              : "the host's screen dropped out. if it's not back in a few seconds, the game pauses for it."}
        </p>
      )}

      <main className="jqzz-phone" key={`${game.status}-${game.index}-${game.interaction}`}>
        {game.status === "LOBBY" && (
          <div className="jqzz-phone-lobby">
            {player ? (
              <>
                <PlayerFace player={player} viewerId={me} className="jqzz-play-face huge" />
                <p className="jqzz-play-prompt">you're in, {player.name}</p>
                {game.roster ? (
                  <div className="jqzz-play-row">
                    <button className="jqzz-play-btn ghost" onClick={() => setRenaming(true)}>
                      not {player.name}? change it
                    </button>
                    <button className="jqzz-play-btn ghost" onClick={() => setIdentityOpen(true)}>
                      change picture
                    </button>
                  </div>
                ) : (
                  <button className="jqzz-play-btn ghost" onClick={() => setIdentityOpen(true)}>
                    change name or picture
                  </button>
                )}
                <p className="jqzz-play-note">waiting for the host to start · {game.players.length} here</p>
                <div className="jqzz-progress-faces">
                  {game.players.map((p) => (
                    <PlayerFace key={p.id} player={p} viewerId={me} />
                  ))}
                </div>
              </>
            ) : (
              <span className="jqzz-annot">joining...</span>
            )}
          </div>
        )}

        {(game.status === "PLAYING" || game.status === "PAUSED") && (
          <PhoneStep
            game={game}
            me={me}
            mine={myAnswer}
            serverNow={serverNow}
            submit={submit}
            vote={vote}
            draw={draw}
            remember={(patch) => q && remember(q.id, patch)}
            answered={answered}
            hurry={hurry}
          />
        )}

        {game.status === "FINISHED" && (
          <div className="jqzz-phone-final">
            {player && player.rank <= 3 && <Confetti pieces={90} />}
            <h1 className="jqzz-stage-title OEF jqzz-chroma">
              {player ? (player.rank === 1 ? "you won" : `#${player.rank}`) : "it's over"}
            </h1>
            {player && <p className="jqzz-play-note">{player.score} points</p>}
            <Podium players={game.players} viewerId={me} />
            {game.recordId != null && player && <SaveFromGame recordId={game.recordId} me={me} folded />}
            <button className="jqzz-play-btn ghost" onClick={() => go("/")}>
              make your own quiz
            </button>
          </div>
        )}
      </main>

      {running && <Doodle code={code} me={me} canDraw={done} />}
      {game.status === "PAUSED" && <div className="jqzz-paused OEF">paused</div>}
      {error && (
        <button className="jqzz-play-error" onClick={() => setError(null)}>
          {error} ✕
        </button>
      )}
      {identity.mounted && user && (
        <IdentityModal
          state={identity.state}
          current={user}
          onSave={() => {
            setIdentityOpen(false);
            // joining again refreshes your name and picture in the game (with a
            // roster, only the picture: the server keeps the name you picked)
            act(() => playService.join(code, me));
          }}
          onClose={() => setIdentityOpen(false)}
        />
      )}
    </PlayFrame>
  );
};

const PhoneStep: React.FC<{
  game: GameState;
  me: string;
  mine: MyAnswer;
  serverNow: () => number;
  submit: (a: Submission) => Promise<boolean>;
  vote: (v: Vote) => Promise<boolean>;
  draw: (picture: Blob) => Promise<string | null>;
  remember: (patch: MyAnswer) => void;
  /** sent, so the clock is all that's left to watch: it gets big */
  answered: boolean;
  /** nudge the host, once you're done; null when there's nothing to nudge */
  hurry: (() => void) | null;
}> = ({ game, me, mine, serverNow, submit, vote, draw, remember, answered, hurry }) => {
  const q = game.question;
  const phase = game.phase;
  const { ask } = modeOf(q);
  // drawing takes the whole screen: the clock stays small, and the sheet keeps its place
  const drawing = phase === "QUESTION" && (ask === "draw" || ask === "chain");
  const answers = { game, me, mine, submit, vote, draw, remember, serverNow };
  const player = game.players.find((p) => p.id === me);
  const gain = game.reveal?.settled ? (game.reveal.gains?.[me] ?? 0) : null;

  const nudged = (game.hurry ?? []).includes(me);
  const waiting = (game.hurry ?? []).length;
  const top = (
    <div className={`jqzz-stage-top jqzz-phone-top${answered ? " answered" : ""}`}>
      {q ? <QuestionHead game={game} /> : <span />}
      <div className="jqzz-timer-slot">
        <Countdown game={game} serverNow={serverNow} size={answered && !drawing ? 168 : drawing ? 56 : 92} />
        {hurry && (
          <button
            className={`jqzz-play-btn small jqzz-hurry${nudged ? " sent" : ""}`}
            disabled={nudged}
            onClick={hurry}
            title="tell the host you're ready for the next one"
          >
            <Glyph name="HURRY" size={13} />
            {nudged ? (waiting > 1 ? `nudged · ${waiting} waiting` : "host nudged") : "hurry the host"}
          </button>
        )}
        {answered && !drawing && <span className="jqzz-annot jqzz-doodle-hint">drag on any empty spot to doodle</span>}
      </div>
    </div>
  );

  if (phase === "WAITING") {
    return (
      <div className="jqzz-phone-wait">
        {top}
        <p className="jqzz-play-prompt">get ready</p>
      </div>
    );
  }

  if (phase === "QUESTION" && q) {
    return (
      <>
        {top}
        <Answering {...answers} />
      </>
    );
  }

  if (phase === "ANSWER" && q) {
    return (
      <>
        {top}
        {game.interaction && game.interaction !== "answer" ? (
          <Judging {...answers} />
        ) : (
          <>
            {ask !== "chain" && <Outcome game={game} me={me} mine={mine} gain={gain} />}
            <p className="jqzz-play-prompt small">{q.text}</p>
            <Reveal game={game} mine={mine} me={me} serverNow={serverNow} controls />
          </>
        )}
      </>
    );
  }

  if (phase === "ELABORATION" && q) {
    return (
      <>
        {top}
        <Outcome game={game} me={me} mine={mine} gain={gain} />
        <div className="jqzz-stage-elab">
          {q.elaborationText ? <p>{q.elaborationText}</p> : <p className="jqzz-play-note">no explanation for this one.</p>}
          <QuestionImage src={q.elaborationImageUrl} ownerId={game.authorId} viewerId={me} />
        </div>
      </>
    );
  }

  // RESULT, or a step without a question
  return (
    <>
      {top}
      {(ask === "rank" || ask === "draw" || ask === "person" || (ask === "pick" && !!game.reveal?.entries)) && game.reveal && (
        <Reveal game={game} mine={mine} me={me} serverNow={serverNow} />
      )}
      {player && (
        <div className="jqzz-phone-rank">
          <span className="jqzz-play-qnum OEF jqzz-chroma">#{player.rank}</span>
          <span>
            {player.score} points{player.gain > 0 ? ` · +${player.gain}` : ""}
          </span>
        </div>
      )}
      <Leaderboard players={game.players} viewerId={me} limit={5} />
    </>
  );
};

/** How your answer did, in one line; and points paid now for an answer earlier. */
const Outcome: React.FC<{ game: GameState; me: string; mine: MyAnswer; gain: number | null }> = ({ game, me, mine, gain }) => {
  const info = describeQuestion(game.question);
  const { ask, score } = info.mode;
  const r = game.reveal;
  const sent =
    mine.picks?.length ||
    mine.text ||
    mine.drawing ||
    (mine.tiers && Object.keys(mine.tiers).length) ||
    (mine.pairs && Object.keys(mine.pairs).length) ||
    mine.choices?.length ||
    mine.person ||
    mine.votes?.length ||
    mine.vote;
  // scored straight from the answers: right or not is known as soon as it's revealed
  const known = score === "right" || (score === "crowd" && ask !== "rank");
  const later = r?.released?.[me] ?? 0;
  const laterLine = later > 0 && <div className="jqzz-later-points">+{later} for your answer earlier</div>;
  // the one whose answer it was had nothing to guess: what they're owed is the line that matters
  if (ask === "person" && r?.settled && r.author === me) return laterLine || null;
  let text: string;
  let tone = "neutral";
  if (r?.held) {
    text = "points come later";
  } else if (gain && gain > 0) {
    text = `+${gain}`;
    tone = "good";
  } else if (!sent) {
    text = ask === "draw" ? "nothing drawn" : "no answer sent";
  } else if (known) {
    text = gain === null ? "answer in" : "not this time";
    tone = gain === null ? "neutral" : "bad";
  } else if (gain === null) {
    text = "counting...";
  } else {
    text = "no points this time";
  }
  return (
    <>
      <div className={`jqzz-outcome ${tone}`}>{text}</div>
      {laterLine}
    </>
  );
};

/** Leaving for good takes your score with it, so it asks once. */
const LeaveButton: React.FC<{ onLeave: () => void; busy: boolean }> = ({ onLeave, busy }) => (
  <ConfirmButton
    label="leave"
    armedLabel="leave? score goes"
    busyLabel="leaving..."
    busy={busy}
    title="leave the game for good: your score goes with you"
    onConfirm={onLeave}
  />
);
