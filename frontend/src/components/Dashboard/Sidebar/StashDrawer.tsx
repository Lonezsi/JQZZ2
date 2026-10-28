import React, { useEffect, useMemo, useState } from "react";
import { useQuiz } from "../../../contexts/QuizContext";
import { errorMessage } from "../../../services/api";
import { imageUrl, stashService } from "../../../services/stashService";
import type { LibraryImage, StashItem, StashKind } from "../../../types/stash";
import { DRAG_IMAGE_KEY, DRAG_SNIPPET_KEY } from "../../../utils/dragKeys";
import { contentToActions, readContent, readType, typeToActions } from "../../../utils/stashContent";
import { typeLabel } from "../../../utils/questionInfo";
import { plural } from "../../../utils/format";
import { Glyph } from "../../common/Glyph";

const KINDS: { kind: StashKind; label: string; icon: string }[] = [
  { kind: "QUESTION", label: "questions", icon: "ITEM_QUESTION" },
  { kind: "QUIZ", label: "quizzes", icon: "QUIZ" },
  { kind: "TYPE", label: "types", icon: "TYPE" },
  { kind: "IMAGE", label: "images", icon: "IMAGE" },
];

/** A picture you can drag onto a step: your uploads, and pictures saved along with questions. */
interface Picture {
  key: string;
  /** what a question stores: the library reference */
  ref: string;
  name: string;
  imageId: number;
}

/**
 * The line between your quizzes and your stash. The arrow sits on it, cutting
 * it: up pulls the stash open under the quizzes, down puts it away. Anywhere
 * else on the line, drag to share the room between the two.
 */
export const StashEdge: React.FC<{
  open: boolean;
  onToggle: () => void;
  onResize: (clientY: number) => void;
  onResizeEnd: () => void;
}> = ({ open, onToggle, onResize, onResizeEnd }) => {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`jqzz-stash-edge${open ? " open" : ""}${dragging ? " dragging" : ""}`}
      onPointerDown={(e) => {
        if (!open || (e.target as Element).closest("button")) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => dragging && onResize(e.clientY)}
      onPointerUp={() => {
        if (!dragging) return;
        setDragging(false);
        onResizeEnd();
      }}
      onPointerCancel={() => setDragging(false)}
    >
      <button
        className="jqzz-stash-arrow"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Put the stash away" : "Open your stash here"}
        title={open ? "put the stash away" : "your stash, under your quizzes"}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="m3.5 10 4.5-4.5 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

/**
 * Your stash, at hand while you edit, under your quizzes in the sidebar. A
 * tap on a row adds it to the end of the open quiz, or drag it in; pictures
 * are dragged onto a step, into one of its slots.
 */
export const StashDrawer: React.FC<{ me: string; quizId: number }> = ({ me, quizId }) => {
  const { appendActions } = useQuiz();
  const [kind, setKind] = useState<StashKind>("QUESTION");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StashItem[] | null>(null);
  const [uploads, setUploads] = useState<LibraryImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  // looked up each time it opens, so something stashed a moment ago is there
  useEffect(() => {
    let cancelled = false;
    stashService
      .list(me)
      .then((d) => {
        if (cancelled) return;
        setItems(d.items);
        setUploads(d.images);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    if (added == null) return;
    const t = window.setTimeout(() => setAdded(null), 1400);
    return () => window.clearTimeout(t);
  }, [added]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items?.forEach((i) => i.kind !== "IMAGE" && (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);

  const pictures = useMemo<Picture[]>(() => {
    const out: Picture[] = uploads.map((img) => ({
      key: `u${img.id}`,
      ref: img.reference,
      name: img.handle,
      imageId: img.id,
    }));
    // saved ones remember the picture they point at in their title
    items?.forEach((i) => {
      if (i.kind === "IMAGE" && i.imageId != null && i.title) {
        out.push({ key: `s${i.id}`, ref: i.title, name: i.handle, imageId: i.imageId });
      }
    });
    return out;
  }, [uploads, items]);
  const count = (k: StashKind) => (k === "IMAGE" ? pictures.length : counts[k]);

  const shownPictures = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pictures.filter((p) => !q || `${p.name} ${p.ref}`.toLowerCase().includes(q));
  }, [pictures, query]);

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
      <section className="jqzz-stash-drawer" aria-label="Your stash">
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
              aria-label={k.label}
              title={k.label}
            >
              <Glyph name={k.icon} size={12} />
              {kind === k.kind && <span>{k.label}</span>}
              {count(k.kind) ? <span className="jqzz-sid-count">{count(k.kind)}</span> : null}
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
        {kind === "IMAGE" ? (
          <ul className="jqzz-stash-drawer-list jqzz-stash-drawer-pics">
            {items !== null && shownPictures.length === 0 && (
              <li className="jqzz-annot jqzz-stash-drawer-empty">
                {query ? "nothing matches" : "no pictures yet. upload one to a question, or save a question that has one."}
              </li>
            )}
            {shownPictures.map((p, i) => (
              <li key={p.key} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <span
                  className="jqzz-stash-pic"
                  draggable
                  title={`${p.name}: drag onto a step`}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_IMAGE_KEY, p.ref);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <img src={imageUrl(p.imageId, me)} alt="" loading="lazy" draggable={false} />
                  <span className="jqzz-stash-pic-name">{p.name}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
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
                title="add to the end of this quiz, or drag it in"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_SNIPPET_KEY, `${item.kind === "TYPE" ? "type" : "stash"}:${item.payload ?? "{}"}`);
                  e.dataTransfer.effectAllowed = "copy";
                }}
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
        )}
      </section>
  );
};
