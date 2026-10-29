import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { notificationService } from "../services/notificationService";
import type { AppNotification } from "../services/notificationService";
import { useWebSocket } from "./useWebSocket";

// one copy for the page, shared by the corner stack and the profile
let cache: { userId: string; list: AppNotification[] } | null = null;
const listeners = new Set<() => void>();
const publish = (userId: string, list: AppNotification[]) => {
  // anything but a list (a page served in its place, say) is no list at all
  cache = { userId, list: Array.isArray(list) ? list : [] };
  listeners.forEach((l) => l());
};

/**
 * Your notifications, kept live: fetched when you sign in (so whatever came
 * while you were away is there at once), and again whenever the server says
 * on /topic/notify/{you} that something changed.
 */
export function useNotifications() {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [list, setList] = useState<AppNotification[]>(cache && cache.userId === me ? cache.list : []);

  const reload = useCallback(() => {
    if (!me) return;
    notificationService
      .list(me)
      .then((l) => publish(me, l))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    const onChange = () => setList(cache && cache.userId === me ? cache.list : []);
    listeners.add(onChange);
    onChange();
    if (!cache || cache.userId !== me) reload();
    return () => {
      listeners.delete(onChange);
    };
  }, [me, reload]);

  useWebSocket(me ? `/topic/notify/${me}` : "/topic/notify/none", reload);

  // read at once on screen, then as the server has it
  const read = useCallback(
    (id: number) => {
      if (!me) return;
      if (cache?.userId === me) publish(me, cache.list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      notificationService
        .read(me, id)
        .then((l) => publish(me, l))
        .catch(() => {});
    },
    [me],
  );
  const readAll = useCallback(() => {
    if (!me) return;
    if (cache?.userId === me) publish(me, cache.list.map((n) => ({ ...n, read: true })));
    notificationService
      .readAll(me)
      .then((l) => publish(me, l))
      .catch(() => {});
  }, [me]);

  return { list, unread: list.filter((n) => !n.read), read, readAll, reload };
}
