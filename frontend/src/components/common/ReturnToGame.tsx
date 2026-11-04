import React, { useEffect, useState } from "react";
import { useHashRoute, go } from "../../hooks/useHashRoute";
import { useMyGames } from "../../hooks/useMyGames";
import type { MyGame } from "../../types/play";

/** how long a ticket stays up when you leave it be, before it bobs down out of the way */
const UP_MS = 10_000;

/**
 * Stepped out of a game you're hosting or playing? A ticket at the bottom, on
 * every page except that game's own screen, with the way back in. Left alone
 * it bobs down till only its edge shows; a hover or a new game brings it up.
 * A paused game gets no ticket: it waits in your notifications (NotificationList).
 */
export const ReturnToGame: React.FC = () => {
  const route = useHashRoute();
  const games = useMyGames();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, where, code] = route.split("/");
  const here = (g: MyGame) =>
    (where === "host" || where === "play" || where === "join") && code?.toUpperCase() === g.code;
  const shown = games.filter((g) => g.status !== "PAUSED" && !here(g) && !hidden.has(g.code)).slice(0, 2);

  // up while you're on it, down UP_MS after you leave it be; which tickets are
  // there counts as new, so a game you've just left comes up again
  const key = shown.map((g) => g.code).join(",");
  const [on, setOn] = useState(false);
  const [downFor, setDownFor] = useState<string | null>(null);
  useEffect(() => {
    if (on || !key) return;
    const t = window.setTimeout(() => setDownFor(key), UP_MS);
    return () => window.clearTimeout(t);
  }, [on, key]);
  const down = !on && downFor === key;

  if (shown.length === 0) return null;
  return (
    <div
      className={`jqzz-return${down ? " down" : ""}`}
      role="status"
      onPointerEnter={() => setOn(true)}
      onPointerLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
    >
      {shown.map((g) => (
        <div key={g.code} className="jqzz-return-card">
          <GameTicket game={g} />
          <button
            className="jqzz-return-hide"
            aria-label="Hide this until next time"
            title="hide"
            onClick={() => setHidden((h) => new Set(h).add(g.code))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

/** a ticket back in: the join code on its stub, the quiz on the rest */
export const GameTicket: React.FC<{ game: MyGame }> = ({ game: g }) => (
  <button
    className="jqzz-return-go"
    onClick={() => go(`/${g.role === "host" ? "host" : "play"}/${g.code}`)}
    aria-label={`Back to ${g.quizName}, game ${g.code}`}
  >
    <span className="jqzz-return-stub" aria-hidden="true">
      {g.code.split("").map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </span>
    <span className="jqzz-return-text">
      <span className="jqzz-annot">
        {g.role === "host" ? "you're hosting" : "you're playing"}
        {g.status === "PAUSED" ? ", paused" : ""}
      </span>
      <b>{g.quizName}</b>
    </span>
    <span className="jqzz-return-arrow" aria-hidden="true">
      back in →
    </span>
  </button>
);
