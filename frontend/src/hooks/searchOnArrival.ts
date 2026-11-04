/*
 * A search to start a page with, left by whatever sent you there (the
 * commands' stash results): the profile page takes it when it opens on that
 * tab, and it's gone after.
 */
let pending: { tab: string; q: string } | null = null;

export const searchOnArrival = (tab: string, q: string) => {
  pending = { tab, q };
};

export const takeSearch = (tab: string): string | null => {
  if (pending?.tab !== tab) return null;
  const q = pending.q;
  pending = null;
  return q;
};
