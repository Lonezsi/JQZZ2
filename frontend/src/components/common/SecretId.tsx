import React, { useEffect, useRef, useState } from "react";
import { Glyph } from "./Glyph";

/**
 * Your id is the key to your account, so it shows like a password: dots until
 * you ask. Copying works either way, without showing it.
 */
export const SecretId: React.FC<{ id: string }> = ({ id }) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () =>
    navigator.clipboard?.writeText(id).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
    });
  return (
    <span className="jqzz-secret">
      <code className={shown ? undefined : "hidden"} aria-label={shown ? undefined : "your id, hidden"}>
        {shown ? id : "•".repeat(id.length)}
      </code>
      <button
        type="button"
        className="jqzz-modal-btn ghost jqzz-secret-btn"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        title={shown ? "hide it" : "show it"}
      >
        <Glyph name={shown ? "EYE_OFF" : "EYE"} size={13} />
        {shown ? "hide" : "show"}
      </button>
      <button type="button" className="jqzz-modal-btn ghost jqzz-secret-btn" onClick={copy} title="copy it">
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
};
