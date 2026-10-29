import React, { useEffect, useState } from "react";
import type { GamePlayer, GameState } from "../../types/play";
import { Avatar, resolveImage } from "../common/Avatar";
import { Atmosphere } from "../common/Atmosphere";
import { useSecondsLeft } from "../../hooks/useGame";
import { typeLabel } from "../../utils/questionInfo";
import { useAuth } from "../../contexts/AuthContext";


/**
 * Something that can't be taken back: the first press arms it and says what
 * will happen, the second does it. It disarms itself after a few seconds.
 */
export const ConfirmButton: React.FC<{
  label: React.ReactNode;
  armedLabel: React.ReactNode;
  busyLabel?: React.ReactNode;
  busy?: boolean;
  title?: string;
  className?: string;
  onConfirm: () => void;
}> = ({ label, armedLabel, busyLabel, busy = false, title, className = "", onConfirm }) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`jqzz-play-btn small ghost danger${armed ? " armed" : ""} ${className}`}
      disabled={busy}
      title={title}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {busy ? (busyLabel ?? label) : armed ? armedLabel : label}
    </button>
  );
};

/** The background and frame every play screen sits in. */
export const PlayFrame: React.FC<{ phase?: string; children: React.ReactNode }> = ({
  phase,
  children,
}) => (
  <div className="jqzz-app jqzz-play" data-phase={phase ?? "IDLE"}>
    <Atmosphere />
    <div className="jqzz-play-frame">{children}</div>
  </div>
);

/** A ring that empties as the step runs out, with the seconds in the middle. */
export const Countdown: React.FC<{
  game: GameState;
  serverNow: () => number;
  size?: number;
  endsAt?: number | null;
  seconds?: number;
}> = ({ game, serverNow, size = 64, endsAt, seconds }) => {
  const deadline = endsAt !== undefined ? endsAt : game.endsAt;
  const total = seconds ?? game.seconds ?? 1;
  const live = useSecondsLeft(game.status === "PAUSED" ? null : deadline, serverNow);
  const left = game.status === "PAUSED" ? (game.pausedLeft ?? 0) / 1000 : (live ?? 0);
  const fraction = Math.max(0, Math.min(1, left / Math.max(1, total)));
  const r = 26;
  const c = 2 * Math.PI * r;
  const urgent = left <= 5 && game.status !== "PAUSED";
  return (
    <div
      className={`jqzz-countdown${urgent ? " urgent" : ""}${game.status === "PAUSED" ? " paused" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
      role="timer"
      aria-label={`${Math.ceil(left)} seconds left`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="track" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
        />
      </svg>
      <span className="jqzz-countdown-n">{game.status === "PAUSED" ? "❚❚" : Math.ceil(left)}</span>
    </div>
  );
};

export const PlayerFace: React.FC<{
  player: Pick<GamePlayer, "id" | "name" | "picture">;
  viewerId?: string;
  className?: string;
}> = ({ player, viewerId, className = "jqzz-play-face" }) => (
  <Avatar
    user={{ id: player.id, name: player.name, profilePictureUrl: player.picture ?? undefined }}
    viewerId={viewerId}
    className={className}
  />
);

/** "Q2 / 5 · single choice", and a track of the questions: done, now, still to come */
export const QuestionHead: React.FC<{ game: GameState }> = ({ game }) => {
  const n = game.questionNumber ?? 0;
  const count = Math.min(game.questionCount, 40);
  return (
    <div className="jqzz-play-qhead-wrap">
      <div className="jqzz-play-qhead">
        <span className="jqzz-play-qnum OEF jqzz-chroma">Q{game.questionNumber ?? "?"}</span>
        <span className="jqzz-annot">
          of {game.questionCount} · {typeLabel(game.question?.type)}
        </span>
        {/* a settings block made it worth more, or nothing */}
        {game.question?.weight != null && (
          <span className="jqzz-type-pill setting">
            {game.question.weight === 0 ? "no points" : `×${game.question.weight / 100}`}
          </span>
        )}
      </div>
      {count > 1 && (
        <span className="jqzz-qtrack" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={i < n - 1 ? "done" : i === n - 1 ? "now" : undefined} />
          ))}
        </span>
      )}
    </div>
  );
};

export const Leaderboard: React.FC<{
  players: GamePlayer[];
  viewerId?: string;
  limit?: number;
  showGain?: boolean;
}> = ({ players, viewerId, limit, showGain = true }) => {
  const shown = limit ? players.slice(0, limit) : players;
  const me = players.find((p) => p.id === viewerId);
  const meHidden = me && !shown.includes(me);
  const row = (p: GamePlayer, i: number) => (
    <li
      key={p.id}
      className={`jqzz-board-row${p.id === viewerId ? " me" : ""}${p.online ? "" : " away"}`}
      style={{ "--i": i } as React.CSSProperties}
    >
      <span className="jqzz-board-rank">{p.rank}</span>
      <PlayerFace player={p} viewerId={viewerId} />
      <span className="jqzz-board-name">{p.name}</span>
      {showGain && p.gain > 0 && <span className="jqzz-board-gain">+{p.gain}</span>}
      <span className="jqzz-board-score">{p.score}</span>
    </li>
  );
  return (
    <ol className="jqzz-board">
      {shown.map(row)}
      {meHidden && (
        <>
          <li className="jqzz-board-gap" aria-hidden="true">
            ⋯
          </li>
          {row(me, shown.length)}
        </>
      )}
    </ol>
  );
};

/** Top three on steps, the rest underneath. */
export const Podium: React.FC<{ players: GamePlayer[]; viewerId?: string }> = ({
  players,
  viewerId,
}) => {
  const top = players.slice(0, 3);
  // second, first, third, the way podiums stand
  const order = [top[1], top[0], top[2]].filter(Boolean) as GamePlayer[];
  return (
    <div className="jqzz-podium-wrap">
      <div className="jqzz-podium">
        {order.map((p) => (
          <div key={p.id} className={`jqzz-podium-spot place-${p.rank}`}>
            <PlayerFace player={p} viewerId={viewerId} className="jqzz-play-face big" />
            <span className="jqzz-podium-name">{p.name}</span>
            <span className="jqzz-podium-score">{p.score}</span>
            <span className="jqzz-podium-block OEF">{p.rank}</span>
          </div>
        ))}
      </div>
      {players.length > 3 && <Leaderboard players={players.slice(3)} viewerId={viewerId} showGain={false} />}
    </div>
  );
};

/** A question's picture, if it has one: a link, or a reference into the image library. */
export const QuestionImage: React.FC<{
  src?: string | null;
  ownerId?: string;
  viewerId?: string;
  className?: string;
}> = ({ src, ownerId, viewerId, className = "jqzz-play-img" }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!src) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    resolveImage(src, ownerId ?? "", viewerId ?? "").then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [src, ownerId, viewerId]);
  if (!url) return null;
  return <img className={className} src={url} alt="" />;
};

/** An option's own picture, in its tile or chip, if it has one. */
export const AnswerPicture: React.FC<{ src?: string | null; game: GameState; className?: string }> = ({
  src,
  game,
  className = "jqzz-tile-img",
}) => {
  const { user } = useAuth();
  if (!src) return null;
  return <QuestionImage src={src} ownerId={game.authorId} viewerId={user?.id ?? ""} className={className} />;
};
