import { useEffect } from "react";
import { setSpace, type Place } from "../../hooks/useSpace";

/** Puts the camera in a place without being a page: the loading screens. `after` waits first, so a quick load never moves it. */
export const InSpace: React.FC<{ place: Place; phase?: string; after?: number }> = ({ place, phase = "IDLE", after = 0 }) => {
  useEffect(() => {
    if (!after) {
      setSpace(place, phase);
      return;
    }
    const t = window.setTimeout(() => setSpace(place, phase), after);
    return () => window.clearTimeout(t);
  }, [place, phase, after]);
  return null;
};
