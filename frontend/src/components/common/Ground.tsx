import React from "react";
import { PLACES, useShownSpace } from "../../hooks/useSpace";
import { Atmosphere } from "./Atmosphere";
import { Star } from "./Star";

/** The one background behind every page, mounted once above all of them. */
export const Ground: React.FC = () => {
  const { place, phase, launch } = useShownSpace();
  return (
    <div
      className="jqzz-app jqzz-ground"
      data-phase={phase}
      data-place={place}
      style={{ "--space-tint": PLACES[place].tint } as React.CSSProperties}
      aria-hidden="true"
    >
      <Atmosphere />
      {launch > 0 && <Star key={launch} />}
    </div>
  );
};
