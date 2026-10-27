import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "./Glyph";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  /** a Glyph name shown before the label */
  icon?: string;
  /** what typing a letter jumps to; defaults to the label when it's text */
  text?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** shown when nothing is chosen (value matches no option) */
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Our dropdown. The list opens in a panel over everything (so a scrolling
 * card can't clip it), its items slide in one after the other, and it works
 * from the keyboard like a native one: arrows, Home/End, Enter, Escape, and
 * typing a letter to jump.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  placeholder = "choose…",
  id,
  className = "",
  disabled,
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  }, []);

  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  // place the panel under the trigger, or over it when there's no room below
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const want = Math.min(320, options.length * 36 + 12);
      const up = window.innerHeight - r.bottom < want + 12 && r.top > want + 12;
      setPlace({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 160), up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length]);

  // a click anywhere else closes it
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  // keep the active item in view
  useEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll<HTMLElement>("[role=option]")[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openAt = (index: number) => {
    setActive(Math.max(0, index));
    setOpen(true);
  };

  const move = (from: number, dir: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + dir * i + options.length) % options.length;
      if (!options[next].disabled) return next;
    }
    return from;
  };

  const onKey = (e: React.KeyboardEvent) => {
    const current = options.findIndex((o) => o.value === value);
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openAt(current >= 0 ? current : 0);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(move(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(move(options.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const start = active + 1;
      for (let i = 0; i < options.length; i++) {
        const o = options[(start + i) % options.length];
        const t = (o.text ?? (typeof o.label === "string" ? o.label : "")).toLowerCase();
        if (!o.disabled && t.startsWith(k)) {
          setActive((start + i) % options.length);
          break;
        }
      }
    }
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={`jqzz-select${open ? " open" : ""}${chosen ? "" : " empty"} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        disabled={disabled}
        onClick={() => (open ? close() : openAt(Math.max(0, options.findIndex((o) => o.value === value))))}
        onKeyDown={onKey}
      >
        {chosen?.icon && <Glyph name={chosen.icon} size={13} />}
        <span className="jqzz-select-value">{chosen ? chosen.label : placeholder}</span>
        <svg className="jqzz-select-caret" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={rest["aria-label"]}
            className={`jqzz-select-panel${place.up ? " up" : ""}`}
            style={{
              left: Math.min(place.left, window.innerWidth - place.width - 8),
              top: place.up ? undefined : place.top,
              bottom: place.up ? window.innerHeight - place.top : undefined,
              minWidth: place.width,
            }}
            onKeyDown={onKey}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={`jqzz-select-item${i === active ? " active" : ""}${o.value === value ? " chosen" : ""}`}
                style={{ "--i": Math.min(i, 14) } as React.CSSProperties}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o.icon && <Glyph name={o.icon} size={13} />}
                <span className="jqzz-select-label">{o.label}</span>
                {o.value === value && (
                  <span className="jqzz-select-check" aria-hidden="true">
                    <Glyph name="CHECK" size={12} />
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
};
