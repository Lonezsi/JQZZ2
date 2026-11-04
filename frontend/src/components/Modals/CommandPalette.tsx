import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { Quiz } from "../../types";
import type { StashItem, StashKind, StashList } from "../../types/stash";
import { COMMANDS } from "../../constants/commands";
import { usePresence, prefersReducedMotion } from "../../hooks/usePresence";
import { useAuth } from "../../contexts/AuthContext";
import { usePeople } from "../../hooks/usePeople";
import { go } from "../../hooks/useHashRoute";
import { searchOnArrival } from "../../hooks/searchOnArrival";
import { stashService } from "../../services/stashService";
import { Keys } from "../common/Keys";
import { matchQuiz } from "../../utils/quizSearch";
import { hits } from "../../utils/search";
import { quizCode } from "../../utils/timecode";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (label: string) => void;
  quizzes: Quiz[];
  onOpenQuiz: (id: number) => void;
}

type Kind = "command" | "quiz" | "stash" | "person";

interface Item {
  kind: Kind;
  key: string;
  icon: string;
  label: string;
  /** a key to press (commands), or a note on the right */
  keys?: string;
  sub?: string;
  /** what in it matched, when it wasn't the name */
  via?: string;
  run: () => void;
}

/** the pills: everything, or one kind of thing; Tab moves along them */
const PILLS: { kind: Kind | null; label: string }[] = [
  { kind: null, label: "all" },
  { kind: "command", label: "commands" },
  { kind: "quiz", label: "quizzes" },
  { kind: "stash", label: "stash" },
  { kind: "person", label: "people" },
];
const SECTION: Record<Kind, string> = { command: "commands", quiz: "quizzes", stash: "your stash", person: "people" };

/** the stash's tab for each kind, and how it's marked here */
const STASH: Record<StashKind, { tab: string; icon: string; noun: string }> = {
  QUIZ: { tab: "quizzes", icon: "▦", noun: "quiz" },
  QUESTION: { tab: "questions", icon: "?", noun: "question" },
  TYPE: { tab: "types", icon: "◫", noun: "type" },
  IMAGE: { tab: "images", icon: "▣", noun: "image" },
  DRAWING: { tab: "drawings", icon: "✎", noun: "drawing" },
};

/**
 * The keys that aren't commands, listed with them so every key is in one
 * place. Picked from here, each does what pressing it does.
 */
const KEYS: { icon: string; label: string; combo: string; press: KeyboardEventInit }[] = [
  { icon: "⌕", label: "Search your quizzes", combo: "/", press: { key: "/" } },
  { icon: "▣", label: "Select every step", combo: "Mod A", press: { key: "a", ctrlKey: true } },
  { icon: "✕", label: "Close, or go up a level", combo: "Esc", press: { key: "Escape" } },
];

/** how many of each kind "all" shows once you type; one kind on its own shows more */
const EACH = 5;
const ALONE = 40;
/** a row and a section label, in px: the lens is moved by them */
const ROW = 42;
const LABEL = 30;

const stashText = (i: StashItem) => [i.title, i.handle, i.source, STASH[i.kind].noun];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onExecute,
  quizzes,
  onOpenQuiz,
}) => {
  const { mounted, state } = usePresence(open, 260);
  const { user } = useAuth();
  const { users } = usePeople();
  const [query, setQuery] = useState("");
  const [pill, setPill] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stash, setStash] = useState<StashList | null>(null);

  // fresh every time it opens, with the stash as it is now
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setPill(0);
    setActiveIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    let gone = false;
    if (user)
      stashService
        .list(user.id)
        .then((s) => !gone && setStash(s))
        .catch(() => {});
    return () => {
      gone = true;
      window.clearTimeout(t);
    };
  }, [open, user]);

  // the arrow keys move the highlight past the edge of the list: bring it into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>(".jqzz-cmd-item");
    if (!rows || rows.length === 0) return;
    rows[Math.min(activeIdx, rows.length - 1)].scrollIntoView({ block: "nearest" });
  }, [activeIdx, query, pill, mounted]);

  const paletteRef = useRef<HTMLDivElement>(null);
  useMorph(paletteRef, mounted, open);

  // the pill that's on: a light glides under it
  const pillsRef = useRef<HTMLDivElement>(null);
  const [glide, setGlide] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const b = pillsRef.current?.querySelectorAll<HTMLElement>(".jqzz-cmd-pill")[pill];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (b) setGlide({ x: b.offsetLeft, w: b.offsetWidth });
  }, [pill, mounted, query]);

  if (!mounted) return null;

  const q = query.trim();
  const only = PILLS[pill].kind;
  const close = (then: () => void) => () => {
    onClose();
    then();
  };

  const all: Record<Kind, Item[]> = {
    command: [
      ...COMMANDS.filter((c) => hits(q, c.label)).map((c): Item => ({
        kind: "command",
        key: c.label,
        icon: c.icon,
        label: c.label,
        keys: c.sub,
        run: close(() => onExecute(c.label)),
      })),
      ...KEYS.filter((k) => hits(q, k.label)).map((k): Item => ({
        kind: "command",
        key: k.label,
        icon: k.icon,
        label: k.label,
        keys: k.combo,
        // once the palette is gone, the key itself
        run: close(() => window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { ...k.press, bubbles: true })), 0)),
      })),
    ],
    // quizzes, stash and people only show up once you type, unless their pill is on
    quiz:
      q || only === "quiz"
        ? quizzes
            .map((quiz) => ({ quiz, m: matchQuiz(quiz, query) }))
            .filter((r) => !q || r.m.hit)
            .map(({ quiz, m }) => ({
              kind: "quiz",
              key: `quiz-${quiz.id}`,
              icon: "↗",
              label: quiz.name,
              sub: quizCode(quiz.id),
              via: q ? m.via : undefined,
              run: close(() => onOpenQuiz(quiz.id)),
            }))
        : [],
    stash:
      q || only === "stash"
        ? [
            ...(stash?.items ?? []).filter((i) => hits(q, ...stashText(i))).map((i): Item => ({
              kind: "stash",
              key: `stash-${i.id}`,
              icon: STASH[i.kind].icon,
              label: i.title || i.handle,
              sub: STASH[i.kind].noun,
              run: close(() => {
                searchOnArrival("stash", i.handle);
                go(`/me/stash/${STASH[i.kind].tab}`);
              }),
            })),
            // a drawing's picture is the drawing: it isn't listed again as an image
            ...(stash?.images ?? [])
              .filter((img) => !stash?.items.some((i) => i.kind === "DRAWING" && i.imageId === img.id))
              .filter((img) => hits(q, img.handle, img.reference, "image"))
              .map((img): Item => ({
              kind: "stash",
              key: `image-${img.id}`,
              icon: STASH.IMAGE.icon,
              label: img.handle,
              sub: "image",
              run: close(() => {
                searchOnArrival("stash", img.handle);
                go("/me/stash/images");
              }),
            })),
          ]
        : [],
    person:
      q || only === "person"
        ? users
            .filter((u) => u.id !== user?.id && hits(q, u.name, u.handle))
            .map((u) => ({
              kind: "person",
              key: `person-${u.id}`,
              icon: u.online ? "●" : "@",
              label: u.name,
              sub: `@${u.handle}`,
              run: close(() => go(`/u/${encodeURIComponent(u.id)}`)),
            }))
        : [],
  };
  const kinds = (only ? [only] : (["command", "quiz", "stash", "person"] as Kind[])).filter((k) => all[k].length);
  // with nothing typed, every command and key is there; typing, a few of each
  const items = kinds.flatMap((k) => all[k].slice(0, only || (!q && k === "command") ? ALONE : EACH));
  const active = Math.min(activeIdx, Math.max(items.length - 1, 0));
  // a label above every section but a lone one
  const labelled = kinds.length > 1 || (only === null && kinds[0] !== "command");
  const firsts = new Set(labelled ? kinds.map((k) => items.findIndex((i) => i.kind === k)) : []);
  const labelsAbove = [...firsts].filter((i) => i <= active).length;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      setPill((p) => (p + (e.shiftKey ? PILLS.length - 1 : 1)) % PILLS.length);
      setActiveIdx(0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      items[active].run();
    }
  };

  return (
    <div className="jqzz-palette-overlay" data-state={state} onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      <div
        ref={paletteRef}
        className="jqzz-palette jqzz-holo"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="jqzz-holo-dots" aria-hidden="true" />
        <div className="jqzz-holo-dust" aria-hidden="true" />
        <div className="jqzz-palette-input-wrap">
          <span className="jqzz-star jqzz-palette-star" aria-hidden="true" />
          <input
            ref={inputRef}
            className="jqzz-palette-input"
            placeholder="a command, a quiz, your stash, someone"
            aria-label="Command, quiz, stash or person"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
          />
          <span className="jqzz-annot">{items.length} results</span>
        </div>
        <div ref={pillsRef} className="jqzz-cmd-pills" role="group" aria-label="Look through">
          {glide && (
            <span
              className="jqzz-cmd-pill-glide"
              aria-hidden="true"
              style={{ "--x": `${glide.x}px`, "--w": `${glide.w}px` } as React.CSSProperties}
            />
          )}
          {PILLS.map((p, i) => {
            const n = p.kind ? all[p.kind].length : null;
            return (
              <button
                key={p.label}
                type="button"
                className="jqzz-cmd-pill"
                aria-pressed={i === pill}
                style={{ "--i": i } as React.CSSProperties}
                onClick={() => {
                  setPill(i);
                  setActiveIdx(0);
                  inputRef.current?.focus();
                }}
              >
                {p.label}
                {q && n !== null && (
                  <span className="jqzz-cmd-pill-n" data-none={n === 0 || undefined}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          ref={listRef}
          className="jqzz-cmd-list"
          role="listbox"
          aria-label="Results"
          style={{ "--active": active, "--offset": `${labelsAbove * LABEL}px`, "--row": `${ROW}px` } as React.CSSProperties}
        >
          {items.length > 0 && <span className="jqzz-cmd-lens" aria-hidden="true" />}
          {items.map((item, i) => (
            <React.Fragment key={item.key}>
              {firsts.has(i) && <div className="jqzz-cmd-section jqzz-annot">{SECTION[item.kind]}</div>}
              <div
                role="option"
                aria-selected={i === active}
                className={`jqzz-cmd-item${i === active ? " active" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                onClick={item.run}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="jqzz-cmd-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="jqzz-cmd-label">
                  {item.label}
                  {item.via && <span className="jqzz-cmd-via">“{item.via}”</span>}
                </span>
                {item.keys ? <Keys combo={item.keys} /> : item.sub && <span className="jqzz-cmd-sub">{item.sub}</span>}
              </div>
            </React.Fragment>
          ))}
          {items.length === 0 && <p className="jqzz-cmd-empty">nothing like that here.</p>}
        </div>
        <div className="jqzz-palette-footer">
          {[
            ["↵", "run"],
            ["↑ ↓", "move"],
            ["Tab", "look through"],
            ["Esc", "close"],
          ].map(([k, v]) => (
            <div key={k} className="jqzz-palette-hint">
              <Keys combo={k} /> {v}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * The palette comes out of the commands button and goes back into it: it
 * grows from where the button is, the button's star flies up to be the
 * palette's, and a thread of light joins the two while it happens. Without
 * the button on screen (or with less motion asked for) it just fades, as
 * modals.css has it.
 */
function useMorph(ref: React.RefObject<HTMLDivElement | null>, mounted: boolean, open: boolean) {
  useLayoutEffect(() => {
    const card = ref.current;
    const button = document.querySelector<HTMLElement>(".jqzz-cmdk");
    if (!mounted || !card || !button || prefersReducedMotion()) return;
    const from = button.getBoundingClientRect();
    if (!from.width) return;
    card.classList.add("morphing");
    const to = card.getBoundingClientRect();
    // the card's transform is left alone by CSS while this runs (.morphing)
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = Math.max(0.08, from.width / to.width);
    const shut = `translate(${dx}px, ${dy}px) scale(${s}, ${Math.max(0.04, from.height / to.height)})`;
    const ms = open ? 460 : 260;
    const ease = open ? "cubic-bezier(0.2, 0.9, 0.25, 1)" : "cubic-bezier(0.5, 0, 0.75, 0.4)";
    const frames = [
      { transform: shut, opacity: 0, borderRadius: "999px" },
      { transform: "none", opacity: 1, borderRadius: getComputedStyle(card).borderRadius },
    ];
    const anim = card.animate(open ? frames : [...frames].reverse(), { duration: ms, easing: ease, fill: "both" });

    // the star, flying between the button's and the palette's
    const a = button.querySelector(".jqzz-star")?.getBoundingClientRect();
    const b = card.querySelector(".jqzz-palette-star")?.getBoundingClientRect();
    const extras: HTMLElement[] = [];
    if (a && b) {
      const star = document.createElement("span");
      star.className = "jqzz-star jqzz-flying-star";
      document.body.appendChild(star);
      extras.push(star);
      const at = (r: DOMRect) => `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
      const path = [
        { transform: `${at(a)} scale(1) rotate(0deg)`, opacity: 1 },
        { transform: `${at(b)} scale(1.45) rotate(${open ? 180 : -180}deg)`, opacity: 1 },
      ];
      star.animate(open ? path : [...path].reverse(), { duration: ms, easing: ease, fill: "both" });

      // the thread: a line of light from one to the other, drawn and let go
      const thread = document.createElement("span");
      thread.className = "jqzz-cmd-thread";
      const x1 = a.left + a.width / 2;
      const y1 = a.top + a.height / 2;
      const x2 = b.left + b.width / 2;
      const y2 = b.top + b.height / 2;
      thread.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
      thread.style.transform = `translate(${x1}px, ${y1}px) rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
      document.body.appendChild(thread);
      extras.push(thread);
      thread.animate(
        open
          ? [
              { clipPath: "inset(0 100% 0 0)", opacity: 1 },
              { clipPath: "inset(0 0 0 0)", opacity: 1, offset: 0.55 },
              { clipPath: "inset(0 0 0 100%)", opacity: 0 },
            ]
          : [
              { clipPath: "inset(0 0 0 100%)", opacity: 0 },
              { clipPath: "inset(0 0 0 0)", opacity: 1, offset: 0.45 },
              { clipPath: "inset(0 100% 0 0)", opacity: 1 },
            ],
        { duration: ms + 120, easing: "ease-out", fill: "both" },
      );
    }
    // landed: the palette's own star takes over from the flying one
    const done = window.setTimeout(() => {
      extras.forEach((e) => e.remove());
      card.classList.remove("morphing");
    }, ms + 140);
    return () => {
      window.clearTimeout(done);
      extras.forEach((e) => e.remove());
      anim.cancel();
      card.classList.remove("morphing");
    };
  }, [ref, mounted, open]);
}
