import React from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationCard } from "../common/Notifications";

/** Every notification, read or not: the bell's long memory, on your profile. */
export const NotificationList: React.FC = () => {
  const { list, unread, read, readAll } = useNotifications();
  return (
    <section className="jqzz-alert-list">
      <div className="jqzz-alert-list-head">
        <span className="jqzz-annot">
          {unread.length ? `${unread.length} unread · ` : ""}
          {list.length} in all
        </span>
        {unread.length > 0 && (
          <button className="jqzz-play-btn small ghost" onClick={readAll}>
            mark all read
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="jqzz-shelf-empty">nothing yet. friend requests and invites to games land here.</p>
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
