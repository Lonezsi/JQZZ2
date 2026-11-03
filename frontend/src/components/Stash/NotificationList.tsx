import React from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationCard } from "../common/Notifications";
import type { AppNotification } from "../../services/notificationService";
import { hits } from "../../utils/search";

/** what a notification can be found by: who, which quiz, and what kind */
const words = (n: AppNotification) => [
  n.from?.name,
  n.from?.handle,
  n.payload.quizName,
  n.payload.text,
  n.kind === "INVITE"
    ? "invite game"
    : n.kind.startsWith("FRIEND")
      ? "friend request"
      : n.kind === "ANNOUNCEMENT"
        ? "announcement"
        : "guest account google",
];

/** Every notification, read or not: the bell's long memory, on your profile. */
export const NotificationList: React.FC<{ query?: string }> = ({ query = "" }) => {
  const { list: all, unread, read, readAll } = useNotifications();
  const list = all.filter((n) => hits(query, ...words(n)));
  return (
    <section className="jqzz-alert-list">
      <div className="jqzz-alert-list-head">
        <span className="jqzz-annot">
          {unread.length ? `${unread.length} unread · ` : ""}
          {list.length === all.length ? `${all.length} in all` : `${list.length} of ${all.length}`}
        </span>
        {unread.length > 0 && (
          <button className="jqzz-play-btn small ghost" onClick={readAll}>
            mark all read
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="jqzz-shelf-empty">
          {all.length ? "none of them match that." : "nothing yet. friend requests and invites to games land here."}
        </p>
      ) : (
        <ul>
          {list.map((n, i) => (
            <li key={n.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <NotificationCard n={n} onRead={() => read(n.id)} inList />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
