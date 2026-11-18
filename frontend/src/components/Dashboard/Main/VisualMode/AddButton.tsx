import React, { useEffect, useState } from "react";
import { SnippetTray } from "./SnippetTray";
import { useAuth } from "../../../../contexts/AuthContext";
import { stashService } from "../../../../services/stashService";
import { errorMessage } from "../../../../services/api";
import type { StashItem } from "../../../../types/stash";
import { SETTING_PRESETS } from "../../../../utils/settings";
import { readContent } from "../../../../utils/stashContent";
import { typeLabel } from "../../../../utils/questionInfo";
import { plural } from "../../../../utils/format";
import { Glide } from "../../../common/Glide";
import { Keys } from "../../../common/Keys";
import { useEscape } from "../../../../hooks/useEscape";
import { ROSTER_EVENT } from "../RosterCard";

const DRAG_SNIPPET_KEY = "jqzz-snippet";

interface AddButtonProps {
  dropOver?: boolean;
  onDropZoneDragOver?: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave?: () => void;
  onDropZoneDrop?: (e: React.DragEvent<HTMLElement>) => void;
  onPick: (snippetId: string) => void;
  /** opened in a gap between two questions: starts open, says so, and closing it lets the gap go */
  here?: boolean;
  onClose?: () => void;
}

type Tab = "types" | "settings" | "stash";
const TABS = [
  { key: "types", label: "types", icon: "TYPE", title: "a new question of a type" },
  { key: "settings", label: "more", icon: "SETTING", title: "settings, notes, section lines, who's coming" },
  { key: "stash", label: "stash", icon: "STASH", title: "questions you saved" },
];

/**
 * End of the timeline: opens the add tray in place, or takes a drop. The same tray opens
 * in a gap between two questions (`here`), which is how a phone, with no dragging, adds
 * one in the middle of a quiz.
 */
export const AddButton: React.FC<AddButtonProps> = ({
  dropOver = false,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onPick,
  here = false,
  onClose,
}) => {
  const [open, setOpenState] = useState(here);
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    setOpenState((o) => {
      const v = typeof next === "function" ? next(o) : next;
      if (!v && here) onClose?.();
      return v;
    });
  };
  const [tab, setTab] = useState<Tab>("types");
  // Esc closes the tray first, before it can close the quiz
  useEscape(open, () => setOpen(false));

  return (
    <div
      className={`jqzz-add${open ? " open" : ""}${dropOver ? " over" : ""}`}
      onDragOver={onDropZoneDragOver}
      onDragLeave={onDropZoneDragLeave}
      onDrop={onDropZoneDrop}
    >
      <button
        className="jqzz-add-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {/* drawn with two bars so it turns into an x around its true centre */}
        <span className="jqzz-add-plus jqzz-plus" aria-hidden="true" />
        {dropOver ? "let go to add it" : open ? (here ? "pick one, it goes here" : "pick one, it goes at the end") : "add"}
      </button>
      <div className="jqzz-add-tray" inert={!open}>
        <div className="jqzz-add-tray-inner">
          <Glide
            className="jqzz-add-tabs"
            label="What to add"
            options={TABS}
            value={tab}
            onPick={(k) => setTab(k as Tab)}
          />
          {tab === "types" && <SnippetTray onPick={onPick} />}
          {tab === "settings" && (
            <SettingsTray
              onPick={onPick}
              onRoster={() => {
                setOpen(false);
                window.dispatchEvent(new Event(ROSTER_EVENT));
              }}
            />
          )}
          {tab === "stash" && open && <StashTray onPick={onPick} />}
        </div>
      </div>
    </div>
  );
};

/** Everything that isn't a question: who's coming, a note, a section line, and the settings blocks that hold for everything after them. */
const SettingsTray: React.FC<{ onPick: (id: string) => void; onRoster: () => void }> = ({ onPick, onRoster }) => (
  <div className="jqzz-tray-grid">
    {/* not a block in the timeline: the list at the top, so it opens there */}
    <button className="jqzz-snippet setting" style={{ "--i": 0 } as React.CSSProperties} onClick={onRoster}>
      <span className="jqzz-snippet-name">
        who's coming <Keys combo="R" />
      </span>
      <span className="jqzz-annot">the names people pick from when they join</span>
    </button>
    {[
      { id: "note", name: "note", note: "for you only, never shown in a game" },
      { id: "divider", name: "section line", note: "splits the quiz into parts, skipped when it runs" },
    ].map((x, i) => (
      <button
        key={x.id}
        className="jqzz-snippet setting"
        style={{ "--i": i + 1 } as React.CSSProperties}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_SNIPPET_KEY, x.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPick(x.id)}
      >
        <span className="jqzz-snippet-name">{x.name}</span>
        <span className="jqzz-annot">{x.note}</span>
      </button>
    ))}
    {SETTING_PRESETS.map((p, i) => (
      <button
        key={p.text}
        className="jqzz-snippet setting"
        style={{ "--i": i + 3 } as React.CSSProperties}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_SNIPPET_KEY, `set:${p.text}`);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPick(`set:${p.text}`)}
      >
        <span className="jqzz-snippet-name">{p.label}</span>
        <span className="jqzz-annot">{p.note}</span>
      </button>
    ))}
  </div>
);

/** Questions and quizzes you saved, ready to drop in with all their steps. */
const StashTray: React.FC<{ onPick: (id: string) => void }> = ({ onPick }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<StashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    stashService
      .list(user.id)
      .then((d) => !cancelled && setItems(d.items.filter((i) => i.kind !== "IMAGE")))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (error) return <p className="jqzz-play-note bad jqzz-tray-note">{error}</p>;
  if (!items) return <p className="jqzz-annot jqzz-tray-note">loading your stash...</p>;
  if (items.length === 0) {
    return (
      <p className="jqzz-tray-note">
        nothing saved yet. save questions after a game, or from <a href="#/stash">your stash</a>.
      </p>
    );
  }
  return (
    <div className="jqzz-tray-grid">
      {items.map((item, i) => {
        const content = readContent(item);
        const first = content.questions[0];
        const id = `stash:${item.payload ?? "{}"}`;
        return (
          <button
            key={item.id}
            className="jqzz-snippet stashed"
            style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_SNIPPET_KEY, id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onPick(id)}
          >
            <span className="jqzz-snippet-name">{item.title || item.handle}</span>
            <span className="jqzz-annot">
              {item.kind === "QUIZ"
                ? `quiz · ${plural(content.questions.length, "question")}`
                : typeLabel(first?.type)}
            </span>
            <span className="jqzz-phase-strip" aria-hidden="true">
              {content.steps.map((s, j) => (
                <span key={j} style={{ flexGrow: Math.max(s.time, 1), background: `var(--phase-${s.phase})` }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
};
