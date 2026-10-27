import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { stashService } from "../services/stashService";
import type { StashItem } from "../types/stash";

// one copy for the whole page: the add tray opens often, the stash changes rarely
let cache: { userId: string; types: StashItem[] } | null = null;
const listeners = new Set<() => void>();

/** Your question types, from the stash. null until they have loaded. */
export function useTypes() {
  const { user } = useAuth();
  const [types, setTypes] = useState<StashItem[] | null>(
    cache && cache.userId === user?.id ? cache.types : null,
  );

  const load = useCallback(() => {
    if (!user) return;
    stashService
      .list(user.id)
      .then((d) => {
        cache = { userId: user.id, types: d.items.filter((i) => i.kind === "TYPE") };
        listeners.forEach((l) => l());
      })
      .catch(() => {
        /* the tray falls back to the built-in ones */
      });
  }, [user]);

  useEffect(() => {
    const onChange = () => setTypes(cache && cache.userId === user?.id ? cache.types : null);
    listeners.add(onChange);
    if (!cache || cache.userId !== user?.id) load();
    return () => {
      listeners.delete(onChange);
    };
  }, [user, load]);

  return types;
}

/** After the stash changed types: everyone showing them reloads. */
export function setTypesCache(userId: string, types: StashItem[]) {
  cache = { userId, types };
  listeners.forEach((l) => l());
}
