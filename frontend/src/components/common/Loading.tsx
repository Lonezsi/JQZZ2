import React, { useEffect } from "react";
import { loadFlightMs, recordLoad, type Place } from "../../hooks/useSpace";
import { InSpace } from "./InSpace";

/**
 * A small spinner and, if there's something to say, what is loading. It only
 * shows up after a quarter of a second (see .jqzz-loading), so a quick load
 * stays a quick load instead of flashing a spinner.
 *
 * A whole page loading (page) doesn't take the background anywhere of its own:
 * it flies toward the place of the page that's on its way, as slowly as that
 * page took to load last time, and notes how long it took this time.
 */
export const Loading: React.FC<{ label?: string; page?: boolean; place?: Place }> = ({ label, page = false, place }) => {
  useEffect(() => {
    if (!page || !place) return;
    const t0 = performance.now();
    return () => recordLoad(place, performance.now() - t0);
  }, [page, place]);
  return (
    <div className={`jqzz-loading${page ? " page" : ""}`} role="status" aria-live="polite">
      {page && place && <InSpace place={place} flight={loadFlightMs(place)} />}
      <span className="jqzz-spinner" aria-hidden="true" />
      <span className="jqzz-annot">{label ?? "loading"}</span>
    </div>
  );
};
