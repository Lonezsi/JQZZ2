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

  // looked up again whenever you move around the app, and now and then
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const look = () =>
      playService
        .mine(user.id)
        .then((g) => !cancelled && setGames(g))
        .catch(() => {});
    look();
    const t = window.setInterval(look, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
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
        <div key={g.code} className="jqzz-return-card">
          <span className="jqzz-return-dot" aria-hidden="true" />
          <span className="jqzz-return-text">
            <span className="jqzz-annot">
              {g.role === "host" ? "you're hosting" : "you're playing"} · {g.code}
              {g.status === "PAUSED" && " · paused"}
            </span>
            <b>{g.quizName}</b>
          </span>
          <button
            className="jqzz-play-btn small primary"
            onClick={() => go(`/${g.role === "host" ? "host" : "play"}/${g.code}`)}
          >
            back to it
          </button>
          <button
            className="jqzz-icon-btn"
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
