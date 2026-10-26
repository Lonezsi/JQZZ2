import React from "react";
import { DitherBlobs } from "./DitherBlobs";

const PHASES = ["IDLE", "WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"];

/**
 * Everything behind the UI, back to front: paper/ink, phase light,
 * dithered blobs, the blended lens textures, then grain.
 */
export const Atmosphere: React.FC = () => (
  <div className="jqzz-aura" aria-hidden="true">
    <span className="shadow" />
    <span className="warm" />
    {PHASES.map((p) => (
      <span key={p} className={`phase phase-${p}`} />
    ))}
    <DitherBlobs />
    <span className="tex tex-floor" />
    <span className="tex tex-lens-a" />
    <span className="tex tex-lens-b" />
  </div>
);

/** Light leaks, huge grain, dust and scratches over everything, like a scanned print. */
export const Imperfections: React.FC = () => (
  <div className="jqzz-imperfections" aria-hidden="true">
    <span className="leaks" />
    <span className="grain-huge" />
    <span className="scratches" />
    <span className="dust" />
  </div>
);
