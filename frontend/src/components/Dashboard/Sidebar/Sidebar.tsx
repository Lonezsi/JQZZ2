import React, { useEffect, useRef, useState } from "react";
import type { User, Quiz } from "../../../types";
import { QuizList } from "./QuizList";
import { Avatar } from "../../common/Avatar";
import { Popover } from "../../common/Popover";
import { PeopleList } from "./PeopleList";
import { usePeople } from "../../../hooks/usePeople";
import { useWebSocket } from "../../../contexts/WebSocketContext";
import { Keys } from "../../common/Keys";
import { ariaShortcut } from "../../../utils/shortcuts";

interface SidebarProps {
  /** phone only: the drawer is pulled out */
  open?: boolean;
  identity: User | null;
  onIdentityClick: () => void;
  quizzes: Quiz[];
  activeQuizId: number | null;
  onSelectQuiz: (id: number) => void;
  onNewQuiz: () => void;
  onImport: () => void;
  onHomeClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  open = false,
  identity,
  onIdentityClick,
  quizzes,
  activeQuizId,
  onSelectQuiz,
  onNewQuiz,
  onImport,
  onHomeClick,
}) => {
  const { users, online } = usePeople();
  const { connected } = useWebSocket();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search from anywhere that isn't a text field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className={`jqzz-sidebar${open ? " open" : ""}`} aria-label="Sidebar">
      <button className="jqzz-logo" onClick={onHomeClick} title="home">
        <span className="jqzz-logo-mark" aria-hidden="true" />
        <span className="jqzz-logo-word OEF">Jqzz</span>
      </button>

      <div className="jqzz-sid-actions">
        <button
          className="jqzz-sid-action primary"
          onClick={onNewQuiz}
          aria-keyshortcuts={ariaShortcut("Mod N")}
        >
          <span className="jqzz-plus" aria-hidden="true" />
          New quiz
          <Keys combo="Mod N" />
        </button>
        <button
          className="jqzz-sid-action"
          onClick={onImport}
          aria-keyshortcuts={ariaShortcut("Mod I")}
        >
          <span className="jqzz-sid-action-icon" aria-hidden="true">
            ↑
          </span>
          Import .txt
          <Keys combo="Mod I" />
        </button>
      </div>

      <div className="jqzz-sid-head">
        <span className="jqzz-sid-label">
          quizzes <span className="jqzz-sid-count">{String(quizzes.length).padStart(2, "0")}</span>
        </span>
      </div>
      <label className="jqzz-search">
        <span className="jqzz-search-icon" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="search quizzes"
          aria-label="Search quizzes and questions"
          aria-keyshortcuts="/"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
        />
        {!query && <Keys combo="/" />}
      </label>

      <QuizList
        quizzes={quizzes}
        query={query}
        activeQuizId={activeQuizId}
        onSelectQuiz={onSelectQuiz}
      />

      <div className="jqzz-sid-account">
        <button
          className="jqzz-identity"
          onClick={onIdentityClick}
          aria-label={identity ? `${identity.name}, @${identity.handle}. Edit identity` : "Make an identity"}
        >
          <span className="jqzz-avatar-wrap">
            {identity ? (
              <Avatar user={identity} viewerId={identity.id} className="jqzz-avatar" />
            ) : (
              <span className="jqzz-avatar">?</span>
            )}
            {/* the dot is the live connection, not a guess */}
            <span
              className={`jqzz-avatar-online${connected ? "" : " down"}`}
              title={connected ? "connected" : "no live connection, retrying"}
            />
          </span>
          <span className="jqzz-identity-text">
            <span className="jqzz-identity-name">{identity?.name ?? "no identity"}</span>
            <span className="jqzz-identity-handle">
              {identity ? `@${identity.handle}` : "click to make one"}
            </span>
          </span>
        </button>

        <div className="jqzz-people-anchor">
          <button
            className={`jqzz-people-btn${peopleOpen ? " open" : ""}`}
            onClick={() => setPeopleOpen((o) => !o)}
            aria-expanded={peopleOpen}
            aria-label={`${online.length} online. Show people`}
            title="who's here"
          >
            <span className="jqzz-people-stack" aria-hidden="true">
              {online.slice(0, 3).map((u) => (
                <Avatar key={u.id} user={u} viewerId={identity?.id} className="jqzz-stack-avatar" />
              ))}
            </span>
            <span className="jqzz-annot">{online.length}</span>
          </button>
          <Popover
            open={peopleOpen}
            onClose={() => setPeopleOpen(false)}
            label="People"
            className="jqzz-holo jqzz-people-pop"
          >
            <div className="jqzz-holo-dots" aria-hidden="true" />
            <div className="jqzz-pop-head">
              <span className="jqzz-pop-title OEF jqzz-chroma">people</span>
              <span className="jqzz-annot">{users.length} on this server</span>
            </div>
            <PeopleList users={users} viewerId={identity?.id} />
          </Popover>
        </div>
      </div>
    </aside>
  );
};
