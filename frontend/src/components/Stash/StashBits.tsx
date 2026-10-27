import React, { useEffect, useRef, useState } from "react";
import type { ImageVisibility } from "../../types";

/* Small pieces the stash and history pages share. */

const VISIBILITY: { value: ImageVisibility; label: string; title: string }[] = [
  { value: "PRIVATE", label: "only me", title: "nobody else can reach it" },
  { value: "SEMI_PRIVATE", label: "shared", title: "anyone with your id and its name can reach it" },
  { value: "PUBLIC", label: "public", title: "anyone can reach it by its name alone" },
];

/** only me / shared / public, the same three steps as the image library */
export const VisibilitySwitch: React.FC<{
  value: ImageVisibility;
  onChange: (v: ImageVisibility) => void;
  busy?: boolean;
}> = ({ value, onChange, busy }) => (
  <div className="jqzz-vis" role="radiogroup" aria-label="Who can reach it" data-value={value}>
    {VISIBILITY.map((v) => (
      <button
        key={v.value}
        type="button"
        role="radio"
        aria-checked={value === v.value}
        title={v.title}
        disabled={busy}
        onClick={() => value !== v.value && onChange(v.value)}
      >
        {v.label}
      </button>
    ))}
  </div>
);

/** The id people use to reach it. A tap copies it. */
export const RefChip: React.FC<{ reference: string; me: string; label?: string }> = ({
  reference,
  me,
  label = "id",
}) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // your own items read as ":handle" to you, the way you'd type them in a quiz
  const shown = reference.startsWith(`${me}:`) ? reference.slice(me.length) : reference;
  return (
    <button
      type="button"
      className={`jqzz-ref${copied ? " copied" : ""}`}
      title={`copy ${reference}`}
      onClick={() =>
        navigator.clipboard?.writeText(reference).then(() => {
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1400);
        })
      }
    >
      <span className="jqzz-annot">{copied ? "copied" : label}</span>
      <code>{shown}</code>
    </button>
  );
};

/** Asks once more before doing something you can't take back. */
export const ConfirmButton: React.FC<{
  onConfirm: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onConfirm, children, disabled }) => {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`jqzz-play-btn small ghost danger${armed ? " armed" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? "sure?" : children}
    </button>
  );
};
