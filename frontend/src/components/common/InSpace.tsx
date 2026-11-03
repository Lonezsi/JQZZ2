import { useEffect } from "react";
import { setSpace, type Place } from "../../hooks/useSpace";

/** Puts the camera in a place without being a page: the loading screens. `flight` is how long to take getting there. */
export const InSpace: React.FC<{ place: Place; phase?: string; after?: number; flight?: number }> = ({
  place,
  phase = "IDLE",
  after = 0,
  flight,
}) => {
  useEffect(() => {
    if (!after) {
      setSpace(place, phase, flight);
      return;
    }
    const t = window.setTimeout(() => setSpace(place, phase, flight), after);
    return () => window.clearTimeout(t);
  }, [place, phase, after, flight]);
  return null;
};
