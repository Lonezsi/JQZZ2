import { useEffect, useState } from "react";

const KEY = "jqzz-sidebar-layout";

export interface SidebarLayout {
  /** the sidebar's width in px, null for the default */
  width: number | null;
  /** the stash is open under the quizzes */
  stashOpen: boolean;
  /** how much of the room under the search the stash takes, 0..1 */
  stashShare: number;
}

const DEFAULTS: SidebarLayout = { width: null, stashOpen: false, stashShare: 0.5 };
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 440;

const remembered = (): SidebarLayout => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
};

/** How you've arranged the sidebar: kept across quiz changes and reloads. */
export function useSidebarLayout() {
  const [layout, setLayout] = useState(remembered);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* private window: it just won't be remembered */
    }
  }, [layout]);
  const update = (patch: Partial<SidebarLayout>) => setLayout((l) => ({ ...l, ...patch }));
  return [layout, update] as const;
}
