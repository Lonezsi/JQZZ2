import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { User, Quiz } from "../../../types";
import { QuizList } from "./QuizList";
import { Avatar } from "../../common/Avatar";
import { Popover } from "../../common/Popover";
import { PeopleList } from "./PeopleList";
import { StashArrow, StashDrawer, StashSplit } from "./StashDrawer";
import { SIDEBAR_MAX, SIDEBAR_MIN, useSidebarLayout } from "../../../hooks/useSidebarLayout";
import { usePeople } from "../../../hooks/usePeople";
import { useFriends } from "../../../hooks/useFriends";
import { useWebSocket } from "../../../contexts/WebSocketContext";
import { Keys } from "../../common/Keys";
import { ariaShortcut, modLabel } from "../../../utils/shortcuts";
import { useQuiz } from "../../../contexts/QuizContext";
import { go } from "../../../hooks/useHashRoute";
import { matchQuiz } from "../../../utils/quizSearch";

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
  /** phone only: put the drawer away */
  onClose?: () => void;
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
  onClose,
}) => {
  const { users, online } = usePeople();
  const { friends, incoming } = useFriends();
  const friendIds = new Set(friends.map((f) => f.id));
  // friends online if there are any, in green; otherwise everyone else online, in grey
  const othersOnline = online.filter((u) => u.id !== identity?.id);
  const friendsOnline = othersOnline.filter((u) => friendIds.has(u.id));
  const shown = friendsOnline.length > 0 ? friendsOnline : othersOnline;
  const activeQuiz = quizzes.find((q) => q.id === activeQuizId);
  const canStash = !!identity && !!activeQuiz;
  const [layout, setLayout] = useSidebarLayout();
  const stashOpen = canStash && layout.stashOpen;
  const asideRef = useRef<HTMLElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  // while dragging an edge, the size follows the pointer without the easing
  const [resizing, setResizing] = useState(false);
  const [share, setShare] = useState(layout.stashShare);
  const [width, setWidth] = useState(layout.width);

  const resizeSplit = (clientY: number) => {
    const box = splitRef.current?.getBoundingClientRect();
    if (!box) return;
    setResizing(true);
    setShare(Math.max(0.18, Math.min(0.82, (box.bottom - clientY) / box.height)));
  };
  const widthDrag = useRef(false);

  // the arrow cuts the line it sits on: where, measured, since it follows the stash link
  const placesRef = useRef<HTMLElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const [cut, setCut] = useState<number | null>(null);
  useLayoutEffect(() => {
    const nav = placesRef.current;
    const arrow = arrowRef.current;
    if (!nav || !arrow) return;
    const measure = () => {
      const n = nav.getBoundingClientRect();
      const a = arrow.getBoundingClientRect();
      setCut(Math.round(a.left + a.width / 2 - n.left));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(nav);
    return () => watch.disconnect();
  }, [canStash]);
  const { connected } = useWebSocket();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { newQuiz, renameQuiz } = useQuiz();
  const makeNamed = async (name: string) => {
    const id = await newQuiz();
    if (id) renameQuiz(id, name);
    setQuery("");
  };

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
    <aside
      ref={asideRef}
      onDragStart={() => {
        // on a phone the drawer covers the quiz: it slides away for the drag, and stays away
        if (!open) return;
        const root = document.documentElement;
        root.classList.add("jqzz-drag-away");
        const done = () => {
          root.classList.remove("jqzz-drag-away");
          onClose?.();
          window.removeEventListener("dragend", done);
          window.removeEventListener("drop", done);
        };
        window.addEventListener("dragend", done);
        window.addEventListener("drop", done);
      }}
      className={`jqzz-sidebar${open ? " open" : ""}${resizing ? " resizing" : ""}`}
      aria-label="Sidebar"
      style={width ? ({ "--sid-w": `${width}px` } as React.CSSProperties) : undefined}
    >
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
        <a className="jqzz-sid-action" href="#/join" aria-keyshortcuts={ariaShortcut("Mod J")}>
          <span className="jqzz-sid-action-icon" aria-hidden="true">
            ⌁
          </span>
          Join a game
          <Keys combo="Mod J" />
        </a>
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
            // nothing matched: Enter makes it
            if (e.key === "Enter" && query.trim() && !quizzes.some((q) => matchQuiz(q, query).hit)) {
              e.preventDefault();
              makeNamed(query.trim());
            }
          }}
        />
        {!query && <Keys combo="/" />}
      </label>

      <div
        ref={splitRef}
        className={`jqzz-sid-split${stashOpen ? " with-stash" : ""}`}
        style={{ "--stash-share": share } as React.CSSProperties}
      >
        <QuizList
          quizzes={quizzes}
          query={query}
          activeQuizId={activeQuizId}
          onSelectQuiz={onSelectQuiz}
          onCreate={makeNamed}
        />
        {stashOpen && (
          <StashSplit
            onResize={resizeSplit}
            onResizeEnd={() => {
              setResizing(false);
              setLayout({ stashShare: share });
            }}
          />
        )}
        {stashOpen && <StashDrawer me={identity!.id} quizId={activeQuiz!.id} />}
      </div>

      {/* your own places: they live on your profile */}
      {identity && (
        <nav
          ref={placesRef}
          className={`jqzz-sid-places${canStash ? " with-arrow" : ""}`}
          aria-label="Yours"
          style={canStash && cut != null ? ({ "--cut": `${cut}px` } as React.CSSProperties) : undefined}
        >
          <a href="#/me/history" aria-keyshortcuts={ariaShortcut("Mod H")} title={`your games · ${modLabel("Mod H")}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8M2.5 2.5v2.4h2.4M8 5v3.2l2 1.4" />
            </svg>
            history
          </a>
          <span className="jqzz-sid-stash">
            {canStash && (
              <StashArrow ref={arrowRef} open={stashOpen} onToggle={() => setLayout({ stashOpen: !stashOpen })} />
            )}
            <a href="#/me/stash" aria-keyshortcuts={ariaShortcut("Mod B")} title={`what you saved · ${modLabel("Mod B")}`}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 5.5h11v7.5h-11zM4 5.5 5.2 3h5.6L12 5.5M6.2 8.5h3.6" />
              </svg>
              stash
            </a>
          </span>
        </nav>
      )}

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
            className={`jqzz-people-btn${peopleOpen ? " open" : ""}${shown.length === 0 ? " bare" : ""}${friendsOnline.length > 0 ? " friends" : ""}`}
            onClick={() => setPeopleOpen((o) => !o)}
            aria-expanded={peopleOpen}
            aria-label={
              friendsOnline.length > 0
                ? `${friendsOnline.length} friends online. Show people`
                : `${othersOnline.length} online. Show people`
            }
            title={friendsOnline.length > 0 ? "friends online" : "who's here"}
          >
            {shown.length > 0 && (
              <span className="jqzz-people-stack" aria-hidden="true">
                {shown.slice(0, 3).map((u) => (
                  <Avatar key={u.id} user={u} viewerId={identity?.id} className="jqzz-stack-avatar" />
                ))}
              </span>
            )}
            <span className="jqzz-annot">{shown.length}</span>
            {incoming.length > 0 && <span className="jqzz-people-ping" aria-label="friend requests" />}
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
            <PeopleList
              users={users}
              viewerId={identity?.id}
              friendIds={friendIds}
              requests={incoming.length}
              onOpen={(id) => {
                setPeopleOpen(false);
                go(id === identity?.id ? "/me/you" : `/u/${encodeURIComponent(id)}`);
              }}
            />
          </Popover>
        </div>
      </div>
      {/* the right edge: drag to make the sidebar wider or narrower, double-click for the usual width */}
      <div
        className="jqzz-sid-resize"
        aria-hidden="true"
        title="drag to resize"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          widthDrag.current = true;
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (!widthDrag.current || !asideRef.current) return;
          const left = asideRef.current.getBoundingClientRect().left;
          setWidth(Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX - left))));
        }}
        onPointerUp={() => {
          if (!widthDrag.current) return;
          widthDrag.current = false;
          setResizing(false);
          setLayout({ width });
        }}
        onPointerCancel={() => {
          widthDrag.current = false;
          setResizing(false);
        }}
        onDoubleClick={() => {
          setWidth(null);
          setLayout({ width: null });
        }}
      />
    </aside>
  );
};
