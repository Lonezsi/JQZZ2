import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHashRoute, go } from "../../hooks/useHashRoute";
import { playService } from "../../services/playService";
import type { MyGame } from "../../types/play";

/**
 * Stepped out of a game you're hosting or playing? A pill in the corner, on
 * every page except that game's own screen, with the way back in.
 */
export const ReturnToGame: React.FC = () => {
  const { user } = useAuth();
  const route = useHashRoute();
  const [games, setGames] = useState<MyGame[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // looked up again whenever you move around the app, or come back to the tab;
  // a game only ends or starts around those moments, so no timer
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const look = () =>
      playService
        .mine(user.id)
        .then((g) => !cancelled && setGames(g))
        .catch(() => {});
    look();
    const back = () => document.visibilityState === "visible" && look();
    document.addEventListener("visibilitychange", back);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", back);
    };
  }, [user, route]);

  const [, where, code] = route.split("/");
  const here = (g: MyGame) =>
    (where === "host" || where === "play" || where === "join") && code?.toUpperCase() === g.code;
  const shown = games.filter((g) => !here(g) && !hidden.has(g.code)).slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <div className="jqzz-return" role="status">
      {shown.map((g) => (
        // a ticket back in: the join code on its stub, the quiz on the rest
        <div key={g.code} className={`jqzz-return-card${g.status === "PAUSED" ? " paused" : ""}`}>
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
