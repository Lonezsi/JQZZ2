import React, { useEffect, useMemo, useState } from "react";
import { useQuiz } from "../../../contexts/QuizContext";
import { errorMessage } from "../../../services/api";
import { stashService } from "../../../services/stashService";
import type { StashItem, StashKind } from "../../../types/stash";
import { contentToActions, readContent, readType, typeToActions } from "../../../utils/stashContent";
import { typeLabel } from "../../../utils/questionInfo";
import { plural } from "../../../utils/format";
import { Glyph } from "../../common/Glyph";

const KEY = "jqzz-stash-drawer";
const KINDS: { kind: StashKind; label: string; icon: string }[] = [
  { kind: "QUESTION", label: "questions", icon: "ITEM_QUESTION" },
  { kind: "QUIZ", label: "quizzes", icon: "QUIZ" },
  { kind: "TYPE", label: "types", icon: "TYPE" },
];

const remembered = () => {
  try {
    return localStorage.getItem(KEY) === "open";
  } catch {
    return false;
  }
};

/**
 * Your stash, at hand while you edit. A small arrow on the sidebar's edge
 * pulls it out of the sidebar; it stays docked there, through quiz changes and
 * reloads, until the arrow pushes it back. A tap on a row adds it to the end
 * of the open quiz.
 */
export const StashDrawer: React.FC<{ me: string; quizId: number }> = ({ me, quizId }) => {
  const { appendActions } = useQuiz();
  const [open, setOpen] = useState(remembered);
  const [kind, setKind] = useState<StashKind>("QUESTION");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, open ? "open" : "closed");
    } catch {
      /* private window: it just won't be remembered */
    }
  }, [open]);

  // looked up each time it opens, so something stashed a moment ago is there
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    stashService
      .list(me)
      .then((d) => {
        if (cancelled) return;
        setItems(d.items);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [open, me]);

  useEffect(() => {
    if (added == null) return;
    const t = window.setTimeout(() => setAdded(null), 1400);
    return () => window.clearTimeout(t);
  }, [added]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items?.forEach((i) => (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter((i) => i.kind === kind)
      .filter((i) => !q || `${i.title ?? ""} ${i.handle} ${i.source ?? ""}`.toLowerCase().includes(q));
  }, [items, kind, query]);

  const add = (item: StashItem) => {
    const actions = item.kind === "TYPE" ? typeToActions(readType(item)) : contentToActions(readContent(item));
    if (actions.length === 0) return;
    appendActions(quizId, actions);
    setAdded(item.id);
  };

  const describe = (item: StashItem) => {
    if (item.kind === "TYPE") return typeLabel(readType(item).questionType);
    const c = readContent(item);
    if (item.kind === "QUIZ") return plural(c.questions.length, "question");
    const first = c.questions[0];
    return `${typeLabel(first?.type)} · ${plural(first?.answers.length ?? 0, "answer")}`;
  };

  return (
    <div className={`jqzz-stash-dock${open ? " open" : ""}`}>
      <section className="jqzz-stash-drawer" aria-label="Your stash" aria-hidden={!open} inert={!open}>
        <div className="jqzz-stash-drawer-head">
          <span className="jqzz-stash-drawer-title OEF">stash</span>
          <a className="jqzz-annot" href="#/me/stash">
            all of it
          </a>
        </div>
        <div className="jqzz-stash-kinds" role="tablist" aria-label="What to show">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              role="tab"
              aria-selected={kind === k.kind}
              className={kind === k.kind ? "on" : undefined}
              onClick={() => setKind(k.kind)}
            >
              <Glyph name={k.icon} size={12} />
              {k.label}
              {counts[k.kind] ? <span className="jqzz-sid-count">{counts[k.kind]}</span> : null}
            </button>
          ))}
        </div>
        <label className="jqzz-search">
          <span className="jqzz-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={`search ${KINDS.find((k) => k.kind === kind)!.label}`}
            aria-label="Search your stash"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          />
        </label>
        <ul className="jqzz-stash-drawer-list">
          {error && <li className="jqzz-annot">{error}</li>}
          {!error && items === null && <li className="jqzz-annot">looking…</li>}
          {items !== null && shown.length === 0 && (
            <li className="jqzz-annot jqzz-stash-drawer-empty">
              {query ? "nothing matches" : "nothing saved here yet. save questions from a game or the editor."}
            </li>
          )}
          {shown.map((item, i) => (
            <li key={item.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <button
                className={`jqzz-stash-drawer-row${added === item.id ? " added" : ""}`}
                onClick={() => add(item)}
                title="add to the end of this quiz"
              >
                <span className="jqzz-stash-drawer-text">
                  <span className="jqzz-stash-drawer-name">{item.title || item.handle}</span>
                  <span className="jqzz-annot">{describe(item)}</span>
                </span>
                <span className="jqzz-stash-drawer-add" aria-hidden="true">
                  <Glyph name={added === item.id ? "CHECK" : "ADD"} size={13} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <button
        className="jqzz-stash-tab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Put the stash away" : "Pull out your stash"}
        title={open ? "put the stash away" : "your stash"}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};
