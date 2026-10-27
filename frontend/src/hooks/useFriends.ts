import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { friendService } from "../services/friendService";
import type { FriendLists } from "../services/friendService";
import { useWebSocket } from "./useWebSocket";

const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [] };

// one copy for the page, shared by the sidebar and the profile
let cache: { userId: string; lists: FriendLists } | null = null;
const listeners = new Set<() => void>();
const publish = (userId: string, lists: FriendLists) => {
  cache = { userId, lists };
  listeners.forEach((l) => l());
};

/**
 * Your friends and requests, kept live: the server says on
 * /topic/friends/{you} whenever either side changes something.
 */
export function useFriends() {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [lists, setLists] = useState<FriendLists>(cache && cache.userId === me ? cache.lists : EMPTY);

  const reload = useCallback(() => {
    if (!me) return;
    friendService
      .list(me)
      .then((l) => publish(me, l))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    const onChange = () => setLists(cache && cache.userId === me ? cache.lists : EMPTY);
    listeners.add(onChange);
    if (!cache || cache.userId !== me) reload();
    return () => {
      listeners.delete(onChange);
    };
  }, [me, reload]);

  useWebSocket(me ? `/topic/friends/${me}` : "/topic/friends/none", reload);

  const add = useCallback(
    (otherId: string) => friendService.add(me, otherId).then((l) => publish(me, l)),
    [me],
  );
  const remove = useCallback(
    (otherId: string) => friendService.remove(me, otherId).then((l) => publish(me, l)),
    [me],
  );
  return { ...lists, add, remove, reload };
}
