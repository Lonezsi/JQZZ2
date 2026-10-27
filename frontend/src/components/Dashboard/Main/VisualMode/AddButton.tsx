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

const DRAG_SNIPPET_KEY = "jqzz-snippet";

interface AddButtonProps {
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
  onPick: (snippetId: string) => void;
}

type Tab = "types" | "settings" | "stash";
const TABS = [
  { key: "types", label: "types", icon: "TYPE", title: "a new question of a type" },
  { key: "settings", label: "settings", icon: "SETTING", title: "settings for what follows" },
  { key: "stash", label: "stash", icon: "STASH", title: "questions you saved" },
];

/** End of the timeline: opens the add tray in place, or takes a drop. */
export const AddButton: React.FC<AddButtonProps> = ({
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onPick,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("types");

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
        {dropOver ? "let go to add it" : open ? "pick one, it goes at the end" : "add"}
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
          {tab === "settings" && <SettingsTray onPick={onPick} />}
          {tab === "stash" && open && <StashTray onPick={onPick} />}
        </div>
      </div>
    </div>
  );
};

/** Settings blocks: they hold for everything after them. */
const SettingsTray: React.FC<{ onPick: (id: string) => void }> = ({ onPick }) => (
  <div className="jqzz-tray-grid">
    {SETTING_PRESETS.map((p, i) => (
      <button
        key={p.text}
        className="jqzz-snippet setting"
        style={{ "--i": i } as React.CSSProperties}
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
  if (!items) return <p className="jqzz-annot jqzz-tray-note">loading your stash…</p>;
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
