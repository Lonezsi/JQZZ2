import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGame } from "../../hooks/useGame";
import { go } from "../../hooks/useHashRoute";
import { playService } from "../../services/playService";
import type { GameState } from "../../types/play";
import { IdentityModal } from "../Modals/IdentityModal";
import { usePresence } from "../../hooks/usePresence";
import { Answering, Judging } from "./Answering";
import type { MyAnswer } from "./Answering";
import { Countdown, Leaderboard, PlayerFace, PlayFrame, Podium, QuestionHead, QuestionImage } from "./PlayCommon";
import { Reveal } from "./Reveal";

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

  // in the game? if not, join it once
  const joining = useRef(false);
  const inGame = !!game?.players.some((p) => p.id === me);
  useEffect(() => {
    if (!game || !me || inGame || joining.current || game.status === "FINISHED") return;
    joining.current = true;
    act(() => playService.join(code, me)).finally(() => {
      joining.current = false;
    });
  }, [game, me, inGame, act, code]);

  if (!game) {
    return (
      <PlayFrame>
        <div className="jqzz-play-center">
          <span className="jqzz-annot">{error ?? "finding the game…"}</span>
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

  const submit = (answer: { picks?: number[]; text?: string; tiers?: Record<number, string> }) =>
    act(() => playService.submit(code, me, answer));
  const vote = (v: { choice?: string; match?: number; guesses?: Record<string, string> }) =>
    act(() => playService.vote(code, me, v));

  return (
    <PlayFrame phase={game.phase}>
      <header className="jqzz-play-bar compact">
        <button className="jqzz-play-btn ghost" onClick={() => go("/")} title="leave this screen">
          ←
        </button>
        <span className="jqzz-play-title">{game.quizName}</span>
        {player && game.status !== "LOBBY" && (
          <span className="jqzz-play-me">
            <span className="jqzz-annot">#{player.rank}</span> {player.score}
          </span>
        )}
      </header>

      <main className="jqzz-phone" key={`${game.status}-${game.index}-${game.interaction}`}>
        {game.status === "LOBBY" && (
          <div className="jqzz-phone-lobby">
            {player ? (
              <>
                <PlayerFace player={player} viewerId={me} className="jqzz-play-face huge" />
                <p className="jqzz-play-prompt">you're in, {player.name}</p>
                <button className="jqzz-play-btn ghost" onClick={() => setIdentityOpen(true)}>
                  change name or picture
                </button>
                <p className="jqzz-play-note">waiting for the host to start · {game.players.length} here</p>
                <div className="jqzz-progress-faces">
                  {game.players.map((p) => (
                    <PlayerFace key={p.id} player={p} viewerId={me} />
                  ))}
                </div>
              </>
            ) : (
              <span className="jqzz-annot">joining…</span>
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
            remember={(patch) => q && remember(q.id, patch)}
          />
        )}

        {game.status === "FINISHED" && (
          <div className="jqzz-phone-final">
            <h1 className="jqzz-stage-title OEF jqzz-chroma">
              {player ? (player.rank === 1 ? "you won" : `#${player.rank}`) : "it's over"}
            </h1>
            {player && <p className="jqzz-play-note">{player.score} points</p>}
            <Podium players={game.players} viewerId={me} />
            <button className="jqzz-play-btn" onClick={() => go("/")}>
              make your own quiz
            </button>
          </div>
        )}
      </main>

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
            // joining again refreshes your name and picture in the game
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
  submit: (a: { picks?: number[]; text?: string; tiers?: Record<number, string> }) => Promise<boolean>;
  vote: (v: { choice?: string; match?: number; guesses?: Record<string, string> }) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
}> = ({ game, me, mine, serverNow, submit, vote, remember }) => {
  const q = game.question;
  const phase = game.phase;
  const player = game.players.find((p) => p.id === me);
  const gain = game.reveal?.settled ? (game.reveal.gains?.[me] ?? 0) : null;

  const top = (
    <div className="jqzz-stage-top">
      {q ? <QuestionHead game={game} /> : <span />}
      <Countdown game={game} serverNow={serverNow} size={52} />
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
        <Answering game={game} me={me} mine={mine} submit={submit} vote={vote} remember={remember} />
      </>
    );
  }

  if (phase === "ANSWER" && q) {
    return (
      <>
        {top}
        {game.interaction && game.interaction !== "answer" ? (
          <Judging game={game} me={me} mine={mine} submit={submit} vote={vote} remember={remember} />
        ) : (
          <>
            <Outcome game={game} mine={mine} gain={gain} />
            <p className="jqzz-play-prompt small">{q.text}</p>
            <Reveal game={game} mine={mine} />
          </>
        )}
      </>
    );
  }

  if (phase === "ELABORATION" && q) {
    return (
      <>
        {top}
        <Outcome game={game} mine={mine} gain={gain} />
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
      {q?.type === "TIERLIST" && game.reveal && <Reveal game={game} mine={mine} />}
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

/** How your answer did, in one line. */
const Outcome: React.FC<{ game: GameState; mine: MyAnswer; gain: number | null }> = ({ game, mine, gain }) => {
  const type = game.question?.type;
  const sent = mine.picks?.length || mine.text || (mine.tiers && Object.keys(mine.tiers).length);
  let text: string;
  let tone = "neutral";
  if (gain && gain > 0) {
    text = `+${gain}`;
    tone = "good";
  } else if (!sent) {
    text = "no answer sent";
  } else if (type === "PREWRITTEN_SINGLE" || type === "PREWRITTEN_MULTIPLE") {
    text = gain === null ? "answer in" : "not this time";
    tone = gain === null ? "neutral" : "bad";
  } else if (gain === null) {
    text = "counting…";
  } else {
    text = "no points this time";
  }
  return <div className={`jqzz-outcome ${tone}`}>{text}</div>;
};
