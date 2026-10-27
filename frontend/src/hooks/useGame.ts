import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "../types/play";
import { playService } from "../services/playService";
import { useWebSocket } from "../contexts/WebSocketContext";
import { errorMessage } from "../services/api";

/**
 * One game, kept current: fetched once, then every change pushed over the
 * socket. Out-of-order messages are dropped by version. Also tracks how far
 * this device's clock is from the server's, so countdowns agree everywhere.
 */
export function useGame(code: string) {
  const { subscribe, connected } = useWebSocket();
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const version = useRef(-1);

  const accept = useCallback((next: GameState) => {
    if (next.version < version.current) return;
    version.current = next.version;
    offset.current = next.now - Date.now();
    setGame(next);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    version.current = -1;
    playService
      .state(code)
      .then((s) => !cancelled && accept(s))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [code, accept]);

  // subscribe again after every reconnect, and catch up on what was missed
  useEffect(() => {
    const sub = subscribe(`/topic/play/${code}`, (msg) => accept(JSON.parse(msg.body)));
    if (sub) playService.state(code).then(accept).catch(() => {});
    return () => sub?.unsubscribe();
  }, [code, subscribe, connected, accept]);

  /** run an action that answers with the state, showing its error if it fails */
  const act = useCallback(
    async (fn: () => Promise<GameState>) => {
      try {
        accept(await fn());
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
      }
    },
    [accept],
  );

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { game, error, setError, act, serverNow };
}

/** Seconds left until `endsAt` (server time), ticking; null when there is no deadline. */
export function useSecondsLeft(endsAt: number | null | undefined, serverNow: () => number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeft(null);
      return;
    }
    const update = () => setLeft(Math.max(0, (endsAt - serverNow()) / 1000));
    update();
    const t = window.setInterval(update, 200);
    return () => window.clearInterval(t);
  }, [endsAt, serverNow]);
  return left;
}
