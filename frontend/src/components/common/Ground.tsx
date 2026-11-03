import React from "react";
import { useShownPhase } from "../../hooks/useAuraPhase";
import { Atmosphere } from "./Atmosphere";

/** The one background behind every page, mounted once above all of them. */
export const Ground: React.FC = () => (
  <div className="jqzz-app jqzz-ground" data-phase={useShownPhase()} aria-hidden="true">
    <Atmosphere />
  </div>
);
