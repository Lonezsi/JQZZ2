import { useLayoutEffect, useSyncExternalStore } from "react";

let phase = "IDLE";
const listeners = new Set<() => void>();

/** the phase the shared background (components/common/Ground.tsx) is showing */
export const useShownPhase = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => phase,
  );

/**
 * Which phase's light the background shows. Each page says so as it mounts
 * (before the first paint), and the background itself stays put: it used to
 * be rebuilt by every page, so opening a game in your history showed a blank
 * one while its textures and clouds painted back in.
 */
export function useAuraPhase(next: string) {
  useLayoutEffect(() => {
    if (phase === next) return;
    phase = next;
    listeners.forEach((l) => l());
  }, [next]);
}
