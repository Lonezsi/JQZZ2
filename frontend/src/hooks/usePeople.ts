import { useContext, useEffect, useState } from "react";
import type { User } from "../types";
import { userService } from "../services/userService";
import { WebSocketContext } from "../contexts/WebSocketContext";
import { useWebSocket } from "./useWebSocket";

interface UserWebSocketMessage {
  event: string;
  user: User;
}

/** a tab that comes back after this long looks again, in case it slept through changes */
const STALE_MS = 60000;

// one copy for the page, however many places show people
let cache: User[] = [];
let fetchedAt = 0;
let loading: Promise<void> | null = null;
let lastApplied = "";
const listeners = new Set<(users: User[]) => void>();
const publish = (next: User[]) => {
  cache = next;
  listeners.forEach((l) => l(next));
};
const refresh = () => {
  loading ??= userService
    .getAll()
    .then((res) => {
      fetchedAt = Date.now();
      publish(Array.isArray(res.data) ? res.data : []);
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
};

/**
 * Everyone on the server, kept live over the websocket: fetched once, then
 * every sign-in, change and sign-out arrives as it happens. It's fetched again
 * only when the socket reconnects (it may have missed some) or a tab comes back
 * after a while, rather than on a timer.
 */
export const usePeople = () => {
  const [users, setUsers] = useState<User[]>(cache);
  const { connected } = useContext(WebSocketContext);

  useEffect(() => {
    listeners.add(setUsers);
    return () => {
      listeners.delete(setUsers);
    };
  }, []);

  // first use, and every (re)connect
  useEffect(() => {
    if (connected || !fetchedAt) refresh();
  }, [connected]);

  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt > STALE_MS) refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);

  useWebSocket<UserWebSocketMessage>("/topic/users", ({ event, user }) => {
    // each mounted copy hears it: the first applies it, the rest skip it
    const key = `${event}:${JSON.stringify(user)}`;
    if (key === lastApplied) return;
    lastApplied = key;
    let next = cache;
    switch (event) {
      case "user_registered":
      case "user_logged_in":
      case "user_updated":
        next = cache.some((u) => u.id === user.id)
          ? cache.map((u) => (u.id === user.id ? (u === user ? u : { ...u, ...user }) : u))
          : [...cache, user];
        break;
      case "user_deleted":
        next = cache.filter((u) => u.id !== user.id);
        break;
      case "user_logged_out":
        next = cache.map((u) => (u.id === user.id ? { ...u, online: false } : u));
        break;
    }
    if (next !== cache) publish(next);
  });

  const online = users.filter((u) => u.online);
  return { users, online, refresh };
};
