import { useEffect, useState, useCallback } from "react";
import type { User } from "../types";
import { userService } from "../services/userService";
import { useWebSocket } from "./useWebSocket";

interface UserWebSocketMessage {
  event: string;
  user: User;
}

/** Everyone on the server, kept live over the websocket. */
export const usePeople = () => {
  const [users, setUsers] = useState<User[]>([]);

  const refresh = useCallback(() => {
    userService
      .getAll()
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  useWebSocket<UserWebSocketMessage>("/topic/users", ({ event, user }) => {
    setUsers((prev) => {
      switch (event) {
        case "user_registered":
        case "user_logged_in":
        case "user_updated":
          return prev.some((u) => u.id === user.id)
            ? prev.map((u) => (u.id === user.id ? user : u))
            : [...prev, user];
        case "user_deleted":
          return prev.filter((u) => u.id !== user.id);
        case "user_logged_out":
          return prev.map((u) => (u.id === user.id ? { ...u, online: false } : u));
        default:
          return prev;
      }
    });
  });

  const online = users.filter((u) => u.online);
  return { users, online, refresh };
};
