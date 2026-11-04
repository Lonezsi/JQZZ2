import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHashRoute } from "./useHashRoute";
import { playService } from "../services/playService";
import type { MyGame } from "../types/play";

/**
 * Games you're hosting or playing that haven't finished. Looked up again
 * whenever you move around the app, or come back to the tab, and now and
 * then while you stay put: a game left behind goes by itself (an empty lobby
 * two minutes after you leave it), and so should the way back to it.
 */
export function useMyGames(): MyGame[] {
  const { user } = useAuth();
  const route = useHashRoute();
  const [games, setGames] = useState<MyGame[]>([]);
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
    const nowAndThen = window.setInterval(back, 30_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", back);
      window.clearInterval(nowAndThen);
    };
  }, [user, route]);
  return games;
}
