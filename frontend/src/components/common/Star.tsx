import React, { useEffect, useState } from "react";

/**
 * The star that shoots up from the loading planet, hangs ahead of the camera
 * while it climbs, and settles on the front page's planet. It's all CSS (see
 * .jqzz-star), timed against the camera's launch in hooks/useSpace.ts; this only
 * puts it in and takes it out.
 */
export const Star: React.FC = () => {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOver(true), 4200);
    return () => window.clearTimeout(t);
  }, []);
  if (over) return null;
  return (
    <div className="jqzz-star" aria-hidden="true">
      <i className="trail" />
      <i className="head" />
    </div>
  );
};
