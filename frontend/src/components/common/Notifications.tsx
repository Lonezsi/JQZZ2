import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { useFriends } from "../../hooks/useFriends";
import { go, useHashRoute } from "../../hooks/useHashRoute";
import type { AppNotification } from "../../services/notificationService";
import type { User } from "../../types";
import { when } from "../../utils/format";
import { Avatar } from "./Avatar";
import { Glyph } from "./Glyph";

/** cards in the corner at once; the rest wait on your profile */
const MAX_SHOWN = 4;
/** ms a card or the bell takes to slide away */
const LEAVE_MS = 340;

/**
 * Your unread notifications, in the corner of every page: a bell with how
 * many, and a card for each under it. New ones slide in and the rest make
 * room; read ones slide out and the rest close up. With nothing left the bell
 * slides off to the right and is gone. Everything, read or not, stays on your
 * profile under notifications.
 *
 * Not over a game's own screens: they come in once you're out of the game.
 */
export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const route = useHashRoute();
  const { unread, read, readAll } = useNotifications();
  const [collapsed, setCollapsed] = useState(false);

  // what's on screen: the newest unread, plus any still sliding away
  const latest = unread.slice(0, MAX_SHOWN);
  const [cards, setCards] = useState<{ n: AppNotification; leaving: boolean }[]>([]);
  const latestKey = latest.map((n) => n.id).join(",");
  const latestRef = useRef(latest);
  useEffect(() => {
    latestRef.current = latest;
  });
  useEffect(() => {
    const now = latestRef.current;
    const ids = new Set(now.map((n) => n.id));
    setCards((prev) => {
      const kept = prev.map((c) => (ids.has(c.n.id) ? { n: now.find((n) => n.id === c.n.id)!, leaving: false } : { ...c, leaving: true }));
      const fresh = now.filter((n) => !prev.some((c) => c.n.id === n.id)).map((n) => ({ n, leaving: false }));
      // newest on top: fresh ones go in above the rest, in the server's order
      return [...fresh, ...kept];
    });
    const t = window.setTimeout(() => setCards((prev) => prev.filter((c) => !c.leaving)), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [latestKey]);

  // the bell: there while anything's unread, sliding off once nothing is
  const [bell, setBell] = useState<"in" | "leaving" | "gone">("gone");
  const any = unread.length > 0;
  useEffect(() => {
    if (any) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBell("in");
      return;
    }
    setBell((b) => (b === "gone" ? "gone" : "leaving"));
    const t = window.setTimeout(() => setBell("gone"), LEAVE_MS + 60);
    return () => window.clearTimeout(t);
  }, [any]);

  const [, where] = route.split("/");
  if (!user || where === "host" || where === "play") return null;
  if (bell === "gone" && cards.length === 0) return null;

  const more = unread.length - latest.length;
  return (
    <aside className="jqzz-inbox" aria-label="Notifications" aria-live="polite">
      {bell !== "gone" && (
        <div className={`jqzz-inbox-bell${bell === "leaving" ? " leaving" : ""}`}>
          <button
            className="jqzz-inbox-bell-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={`${unread.length} unread. ${collapsed ? "Show" : "Hide"} them`}
            title={collapsed ? "show them" : "tuck them away"}
          >
            <Glyph name="BELL" size={14} />
            <span className="jqzz-inbox-count">{unread.length}</span>
          </button>
          <a className="jqzz-inbox-all" href="#/me/notifications" title="all of them, read too">
            all
          </a>
          <button className="jqzz-inbox-clear" onClick={readAll} title="mark them all read" aria-label="Mark all read">
            <Glyph name="CHECK" size={12} />
          </button>
        </div>
      )}
      {!collapsed &&
        cards.map(({ n, leaving }, i) => (
          <div key={n.id} className={`jqzz-inbox-slot${leaving ? " leaving" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <div className="jqzz-inbox-clip">
              <NotificationCard n={n} onRead={() => read(n.id)} />
            </div>
          </div>
        ))}
      {!collapsed && more > 0 && (
        <a className="jqzz-inbox-more" href="#/me/notifications">
          +{more} more
        </a>
      )}
    </aside>
  );
};

/** One notification and what you can do about it; the corner and the profile share it. */
export const NotificationCard: React.FC<{ n: AppNotification; onRead: () => void; inList?: boolean }> = ({
  n,
  onRead,
  inList = false,
}) => {
  const { user } = useAuth();
  const { friends, incoming, add, remove } = useFriends();
  const [busy, setBusy] = useState(false);
  const who = n.from?.name ?? "someone";
  const fromId = n.from?.id;
  const act = (p: Promise<unknown>) => {
    setBusy(true);
    p.catch(() => {}).finally(() => setBusy(false));
  };

  let text: React.ReactNode;
  let actions: React.ReactNode = null;
  if (n.kind === "FRIEND_REQUEST") {
    const pending = !!fromId && incoming.some((p) => p.id === fromId);
    const friendsNow = !!fromId && friends.some((p) => p.id === fromId);
    text = friendsNow ? (
      <>
        you and <b>{who}</b> are friends
      </>
    ) : (
      <>
        <b>{who}</b> wants to be friends
      </>
    );
    // still waiting for an answer: answerable, even once the card itself is read
    if (pending) {
      actions = (
        <>
          {/* answered: it goes at once, not when the server gets round to saying so */}
          <button
            className="jqzz-play-btn small primary"
            disabled={busy}
            onClick={() => {
              if (!n.read) onRead();
              act(add(fromId!));
            }}
          >
            accept
          </button>
          <button
            className="jqzz-play-btn small ghost"
            disabled={busy}
            onClick={() => {
              if (!n.read) onRead();
              act(remove(fromId!));
            }}
          >
            no thanks
          </button>
        </>
      );
    }
  } else if (n.kind === "FRIEND_ACCEPTED") {
    text = (
      <>
        <b>{who}</b> said yes: you're friends now
      </>
    );
  } else if (n.kind === "INVITE") {
    const quiz = n.payload.quizName || "a quiz";
    text = n.payload.rematch ? (
      <>
        <b>{who}</b> is playing <b>{quiz}</b> again
      </>
    ) : (
      <>
        <b>{who}</b> invited you to <b>{quiz}</b>
      </>
    );
    if (n.payload.code) {
      actions = (
        <button
          className="jqzz-play-btn small primary"
          onClick={() => {
            if (!n.read) onRead();
            go(`/join/${n.payload.code}`);
          }}
        >
          join
        </button>
      );
    }
  } else {
    text = <>something new</>;
  }

  return (
    <div className={`jqzz-alert kind-${n.kind}${n.read ? " read" : ""}${inList ? " in-list" : ""}`}>
      <a
        className="jqzz-alert-face"
        href={fromId ? `#/u/${encodeURIComponent(fromId)}` : undefined}
        aria-label={fromId ? `${who}'s profile` : undefined}
      >
        {n.from ? (
          <Avatar user={n.from as unknown as User} viewerId={user?.id} className="jqzz-alert-avatar" />
        ) : (
          <Glyph name="BELL" size={14} />
        )}
        <span className="jqzz-alert-kind" aria-hidden="true">
          <Glyph name={n.kind === "INVITE" ? "QUIZ" : "FRIENDS"} size={10} />
        </span>
      </a>
      <div className="jqzz-alert-body">
        <span className="jqzz-alert-text">{text}</span>
        {n.createdAt && <span className="jqzz-annot">{when(n.createdAt)}</span>}
        {actions && <div className="jqzz-alert-actions">{actions}</div>}
      </div>
      {!n.read && (
        <button className="jqzz-alert-x" onClick={onRead} aria-label="Mark read" title="mark read">
          <Glyph name="CLOSE" size={11} />
        </button>
      )}
    </div>
  );
};
