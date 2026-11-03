import React from "react";

/**
 * A small spinner and, if there's something to say, what is loading. It only
 * shows up after a quarter of a second (see .jqzz-loading), so a quick load
 * stays a quick load instead of flashing a spinner.
 */
export const Loading: React.FC<{ label?: string; page?: boolean }> = ({ label, page = false }) => (
  <div className={`jqzz-loading${page ? " page" : ""}`} role="status" aria-live="polite">
    <span className="jqzz-spinner" aria-hidden="true" />
    <span className="jqzz-annot">{label ?? "loading"}</span>
  </div>
);
