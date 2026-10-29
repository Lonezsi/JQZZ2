import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGame } from "../../hooks/useGame";
import { go, joinUrl } from "../../hooks/useHashRoute";
import { playService } from "../../services/playService";
import type { GameState } from "../../types/play";
import { ConfirmButton, Countdown, Leaderboard, PlayerFace, PlayFrame, Podium, QuestionHead, QuestionImage, AnswerPicture } from "./PlayCommon";
import { Doodle } from "./Doodle";
import { nameOf, tileColour, tileLetter } from "../../utils/play";
import { Reveal } from "./Reveal";
import { SaveFromGame } from "../Stash/SaveFromGame";
import { BackButton } from "../common/BackButton";
import { Confetti } from "../common/Confetti";
import { InvitePeople } from "./InvitePeople";
import { Glyph } from "../common/Glyph";

/** The big screen: what the room looks at while the host runs the game. */
export const HostScreen: React.FC<{ code: string }> = ({ code }) => {
  const { user } = useAuth();
  const { game, error, setError, act, serverNow } = useGame(code);
  const me = user?.id ?? "";
  const { drawers, saw } = useDrawers();

  if (!game) {
    return (
      <PlayFrame>
        <div className="jqzz-play-center">
          <span className="jqzz-annot">{error ?? "loading the game…"}</span>
          {error && (
            <button className="jqzz-play-btn" onClick={() => go("/")}>
              back to the editor
            </button>
          )}
        </div>
      </PlayFrame>
    );
  }

  if (game.hostId !== me) {
    return (
      <PlayFrame>
        <div className="jqzz-play-center">
          <p className="jqzz-play-prompt">this is someone else's game.</p>
          <button className="jqzz-play-btn primary" onClick={() => go(`/play/${code}`)}>
            join it as a player
          </button>
        </div>
      </PlayFrame>
    );
  }

  const run = (fn: (code: string, userId: string) => Promise<GameState>) => act(() => fn(code, me));
  const live = game.status === "PLAYING" || game.status === "PAUSED";

  return (
    <PlayFrame phase={game.phase}>
      <header className="jqzz-play-bar">
        <BackButton label="jqzz" />
        <span className="jqzz-play-title">{game.quizName}</span>
        <span className="jqzz-play-code" title="the join code">
          <span className="jqzz-annot">join</span> {game.code}
        </span>
        {live && (
          <div className="jqzz-play-controls">
            <span className="jqzz-annot">
              step {game.index + 1}/{game.total}
            </span>
            {game.status === "PAUSED" ? (
              <button className="jqzz-play-btn" onClick={() => run(playService.resume)}>
                ▶ resume
              </button>
            ) : (
              <button className="jqzz-play-btn" onClick={() => run(playService.pause)}>
                ❚❚ pause
              </button>
            )}
            <button
              key={`skip-${(game.hurry ?? []).length}`}
              className={`jqzz-play-btn${(game.hurry ?? []).length ? " nudged" : ""}`}
              onClick={() => run(playService.skip)}
              title="next step now"
            >
              ▶▶ skip
            </button>
            <button
              className="jqzz-play-btn danger"
              onClick={() => confirm("end the game now? scores so far stand.") && run(playService.end)}
            >
              ■ end
            </button>
          </div>
        )}
      </header>

      <main className="jqzz-stage" key={`${game.status}-${game.index}`}>
        {game.status === "LOBBY" && <HostLobby game={game} me={me} run={run} act={act} />}
        {live && <HostStep game={game} me={me} serverNow={serverNow} />}
        {game.status === "FINISHED" && (
          <div className="jqzz-stage-final">
            {game.players.length > 0 && <Confetti />}
            <h1 className="jqzz-stage-title OEF jqzz-chroma">final scores</h1>
            {game.players.length ? (
              <Podium players={game.players} viewerId={me} />
            ) : (
              <p className="jqzz-play-note">nobody played.</p>
            )}
            <div className="jqzz-play-row">
              <button className="jqzz-play-btn primary" onClick={() => run(playService.restart)}>
                play again
              </button>
              <button className="jqzz-play-btn" onClick={() => go("/")}>
                back to the editor
              </button>
            </div>
            {game.recordId != null && <SaveFromGame recordId={game.recordId} me={me} folded />}
          </div>
        )}
      </main>

      {live && <Doodle code={code} me={me} canDraw={false} onTrail={saw} />}
      {live && <WhileTheyWait game={game} me={me} drawers={drawers} onSkip={() => run(playService.skip)} />}
      {live && (
        <div className="jqzz-quit-dock">
          <ConfirmButton
            label="end game"
            armedLabel="end it for everyone?"
            title="end the game now: scores so far stand"
            onConfirm={() => run(playService.end)}
          />
        </div>
      )}
      {game.status === "PAUSED" && <div className="jqzz-paused OEF">paused</div>}
      {error && (
        <button className="jqzz-play-error" onClick={() => setError(null)}>
          {error} ✕
        </button>
      )}
    </PlayFrame>
  );
};

const HostLobby: React.FC<{
  game: GameState;
  me: string;
  run: (fn: (code: string, userId: string) => Promise<GameState>) => Promise<boolean>;
  act: (fn: () => Promise<GameState>) => Promise<boolean>;
}> = ({ game, me, run, act }) => {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(game.code);
  return (
    <div className="jqzz-lobby">
      <span className="jqzz-annot">go to jqzz and join with</span>
      <div className="jqzz-lobby-code" aria-label={`join code ${game.code.split("").join(" ")}`}>
        {game.code.split("").map((c, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties}>
            {c}
          </span>
        ))}
      </div>
      <button
        className="jqzz-lobby-link"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          });
        }}
        title="copy the link"
      >
        {url.replace(/^https?:\/\//, "")} <span className="jqzz-annot">{copied ? "copied" : "copy"}</span>
      </button>
      <InvitePeople game={game} me={me} />

      <div className="jqzz-lobby-people">
        {game.players.length === 0 && <p className="jqzz-play-note">waiting for people to join…</p>}
        {game.players.map((p, i) => (
          <button
            key={p.id}
            className={`jqzz-lobby-player${p.online ? "" : " away"}`}
            style={{ "--i": i } as React.CSSProperties}
            title="remove from the game"
            onClick={() =>
              confirm(`remove ${p.name} from the game?`) &&
              act(() => playService.kick(game.code, me, p.id))
            }
          >
            <PlayerFace player={p} viewerId={me} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      <button
        className="jqzz-play-btn primary big"
        disabled={game.players.length === 0}
        onClick={() => run(playService.start)}
      >
        start · {game.players.length} {game.players.length === 1 ? "player" : "players"}
      </button>
    </div>
  );
};

const HostStep: React.FC<{ game: GameState; me: string; serverNow: () => number }> = ({
  game,
  me,
  serverNow,
}) => {
  const q = game.question;
  const phase = game.phase;
  // out of everyone in the game; people who've dropped off just won't hold it up
  const everyone = game.players.length;

  if (phase === "WAITING") {
    return (
      <div className="jqzz-stage-wait">
        <QuestionHead game={game} />
        <Countdown game={game} serverNow={serverNow} size={230} />
        <p className="jqzz-play-note">get ready</p>
      </div>
    );
  }

  if (phase === "RESULT") {
    // choices were already shown in their own reveal; tier lists and written answers
    // are worth seeing again next to the scores (a tier list round may have no reveal)
    const worthShowing = q && q.type !== "PREWRITTEN_SINGLE" && q.type !== "PREWRITTEN_MULTIPLE";
    return (
      <div className="jqzz-stage-result">
        <div className="jqzz-stage-top">
          {q && <QuestionHead game={game} />}
          <Countdown game={game} serverNow={serverNow} size={110} />
        </div>
        {worthShowing && game.reveal && <Reveal game={game} />}
        <Leaderboard players={game.players} viewerId={me} limit={8} />
      </div>
    );
  }

  if (!q) return null;
  const answered = game.answered ?? [];
  const acted = game.acted ?? [];
  const bracket = game.reveal?.bracket;

  return (
    <div className={`jqzz-stage-q phase-${phase}`}>
      <div className="jqzz-stage-top">
        <QuestionHead game={game} />
        <Countdown game={game} serverNow={serverNow} size={phase === "QUESTION" ? 170 : 110} />
      </div>
      <h1 className={`jqzz-stage-prompt jqzz-holo sheen${phase === "QUESTION" ? "" : " small"}`}>{q.text}</h1>

      {phase === "QUESTION" && (
        <>
          <QuestionImage src={q.imageUrl} ownerId={game.authorId} viewerId={me} className="jqzz-stage-img" />
          {(q.type === "PREWRITTEN_SINGLE" || q.type === "PREWRITTEN_MULTIPLE") && (
            <div className="jqzz-tiles">
              {q.answers.map((a, i) => (
                <div key={a.id} className="jqzz-tile" style={{ "--tile": tileColour(i) } as React.CSSProperties}>
                  <AnswerPicture src={a.imageUrl} game={game} />
                  <span className="jqzz-tile-letter">{tileLetter(i)}</span>
                  <span className="jqzz-tile-text">{a.text || "…"}</span>
                </div>
              ))}
            </div>
          )}
          {q.type === "TIERLIST" && (
            <div className="jqzz-tier-items preview">
              {q.answers.map((a) => (
                <span key={a.id} className="jqzz-chip">
                  <AnswerPicture src={a.imageUrl} game={game} className="jqzz-chip-img" />
                  {a.text}
                </span>
              ))}
            </div>
          )}
          {q.type !== "PREWRITTEN_SINGLE" && q.type !== "PREWRITTEN_MULTIPLE" && q.type !== "TIERLIST" && (
            <p className="jqzz-play-note">everyone's writing their answer on their phone</p>
          )}
          <Progress label="answered" done={answered} game={game} total={everyone} me={me} />
        </>
      )}

      {phase === "ANSWER" && (
        <>
          {bracket && !bracket.done && bracket.roundEndsAt && (
            <div className="jqzz-stage-round">
              <span className="jqzz-annot">this round</span>
              <Countdown
                game={game}
                serverNow={serverNow}
                size={44}
                endsAt={bracket.roundEndsAt}
                seconds={Math.max(1, (game.seconds ?? 10) / Math.max(1, bracket.rounds))}
              />
            </div>
          )}
          <Reveal game={game} />
          {game.interaction && (
            <Progress
              label={game.interaction === "guess" ? "guessing" : "voted"}
              done={acted}
              game={game}
              total={everyone}
              me={me}
            />
          )}
        </>
      )}

      {phase === "ELABORATION" && (
        <div className="jqzz-stage-elab">
          {q.elaborationText ? <p>{q.elaborationText}</p> : <p className="jqzz-play-note">no explanation written for this one.</p>}
          <QuestionImage src={q.elaborationImageUrl} ownerId={game.authorId} viewerId={me} className="jqzz-stage-img" />
        </div>
      )}
    </div>
  );
};

/**
 * In the corner of the host's screen: who's done and wants the next one, and
 * who's passing the time drawing.
 */
const WhileTheyWait: React.FC<{ game: GameState; me: string; drawers: string[]; onSkip: () => void }> = ({
  game,
  me,
  drawers,
  onSkip,
}) => {
  const people = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => game.players.find((p) => p.id === id)).filter((p) => !!p);
  const hurry = people(game.hurry);
  const drawing = people(drawers);
  if (!hurry.length && !drawing.length) return null;
  const faces = (list: typeof hurry) => (
    <span className="jqzz-wait-faces">
      {list.slice(0, 8).map((p) => (
        <span key={p.id} className="jqzz-wait-face" title={p.name}>
          <PlayerFace player={p} viewerId={me} />
        </span>
      ))}
      {list.length > 8 && <span className="jqzz-annot">+{list.length - 8}</span>}
    </span>
  );
  return (
    <aside className="jqzz-wait" aria-live="polite">
      {hurry.length > 0 && (
        <div className="jqzz-wait-row hurry">
          <Glyph name="HURRY" size={14} />
          <span className="jqzz-wait-label">
            {hurry.length === 1 ? `${hurry[0].name} wants` : `${hurry.length} want`} the next one
          </span>
          {faces(hurry)}
          <button className="jqzz-play-btn small primary" onClick={onSkip}>
            go on
          </button>
        </div>
      )}
      {drawing.length > 0 && (
        <div className="jqzz-wait-row drawing">
          <Glyph name="PEN" size={14} />
          <span className="jqzz-wait-label">{drawing.length === 1 ? `${drawing[0].name} is` : `${drawing.length} are`} drawing</span>
          {faces(drawing)}
        </div>
      )}
    </aside>
  );
};

/** how long after their last trail someone still counts as drawing */
const DRAWING_MS = 2500;

/** Who's drawing: whoever's trail came in within the last moment. */
function useDrawers() {
  const last = useRef(new Map<string, number>());
  const [drawers, setDrawers] = useState<string[]>([]);
  const saw = useCallback((from: string) => {
    const known = last.current.has(from);
    last.current.set(from, Date.now());
    if (!known) setDrawers([...last.current.keys()]);
  }, []);
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, at] of last.current) {
        if (now - at > DRAWING_MS) {
          last.current.delete(id);
          changed = true;
        }
      }
      if (changed) setDrawers([...last.current.keys()]);
    }, 500);
    return () => window.clearInterval(t);
  }, []);
  return { drawers, saw };
}

const Progress: React.FC<{ label: string; done: string[]; game: GameState; total: number; me: string }> = ({
  label,
  done,
  game,
  total,
  me,
}) => (
  <div className="jqzz-progress">
    <span className="jqzz-progress-meter" aria-hidden="true">
      <span style={{ width: `${total ? (done.length / total) * 100 : 0}%` }} />
    </span>
    <span className="jqzz-annot">
      {done.length}/{total} {label}
    </span>
    <div className="jqzz-progress-faces">
      {done.map((id) => {
        const p = game.players.find((x) => x.id === id);
        return p ? <PlayerFace key={id} player={p} viewerId={me} /> : null;
      })}
    </div>
    <span className="visually-hidden">{done.map((id) => nameOf(game, id)).join(", ")}</span>
  </div>
);
