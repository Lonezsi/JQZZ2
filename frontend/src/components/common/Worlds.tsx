import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { registerWorldItem, useShownSpace, type Place } from "../../hooks/useSpace";

/** what a planet is made of besides its ball: a ring, rings of signal, moons */
const PARTS: Record<Place, { ring?: boolean; halo?: boolean; moons?: number }> = {
  loading: {},
  game: {},
  editor: {},
  history: { ring: true },
  stash: { moons: 2 },
  shelf: { moons: 4 },
  notifications: { halo: true },
  friends: { moons: 1 },
  you: { moons: 1 },
  settings: { ring: true },
  admin: { ring: true },
};

/** how long the planet you left stays in the sky: past the end of the camera's flight */
const LINGER_MS = 3600;

/**
 * The planets in the sky: the one of the place you're in and, for a moment
 * after a move, the one you left. Nothing else is built, so a place nobody is
 * in costs nothing. Where they hang is the camera's (hooks/useSpace.ts).
 */
export const Worlds: React.FC = () => {
  const { place } = useShownSpace();
  const [here, setHere] = useState<Place[]>([place]);
  // the new place is in the sky in the same render that says it's the place
  if (!here.includes(place)) setHere([...here, place]);
  useEffect(() => {
    const t = window.setTimeout(() => setHere((h) => h.filter((p) => p === place)), LINGER_MS);
    return () => window.clearTimeout(t);
  }, [place]);
  return (
    <>
      {here.map((p) => (
        <World key={p} place={p} current={p === place} />
      ))}
    </>
  );
};

const World: React.FC<{ place: Place; current: boolean }> = ({ place, current }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (ref.current ? registerWorldItem(ref.current, place) : undefined), [place]);
  const parts = PARTS[place];
  return (
    <div ref={ref} className={`world-item${current ? "" : " leaving"}`}>
      <div className="planet" data-kind={place}>
        {parts.ring && <span className="ring back" />}
        <span className="orb" />
        {parts.halo && <span className="halo" />}
        {parts.ring && <span className="ring front" />}
        {Array.from({ length: parts.moons ?? 0 }, (_, i) => (
          <span key={i} className={`moon m${i + 1}`} />
        ))}
      </div>
    </div>
  );
};
