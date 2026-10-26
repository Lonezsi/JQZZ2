import React, { useEffect, useRef } from "react";
import { usePresence } from "../../hooks/usePresence";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  label: string;
  children: React.ReactNode;
}

/** A panel that animates in and out, closing on Escape or an outside click. */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  className = "",
  label,
  children,
}) => {
  const { mounted, state } = usePresence(open, 200);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      // the trigger lives in the parent; let it toggle instead of closing twice
      const host = ref.current?.parentElement;
      if (host && !host.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <div
      ref={ref}
      className={`jqzz-popover ${className}`}
      data-state={state}
      role="dialog"
      aria-label={label}
    >
      {children}
    </div>
  );
};
