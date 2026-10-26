import React from "react";
import type { User } from "../../../types";
import { Avatar } from "../../common/Avatar";

interface PeopleListProps {
  users: User[];
  viewerId: string | undefined;
}

/** Everyone on the server, online first. */
export const PeopleList: React.FC<PeopleListProps> = ({ users, viewerId }) => {
  const sorted = [...users].sort((a, b) => Number(b.online) - Number(a.online));
  const online = sorted.filter((u) => u.online);
  const offline = sorted.filter((u) => !u.online);

  const row = (u: User, i: number) => (
    <div
      key={u.id}
      className={`jqzz-user-row${u.online ? "" : " is-offline"}`}
      style={{ "--i": i } as React.CSSProperties}
    >
      <Avatar
        user={u}
        viewerId={viewerId}
        className={`jqzz-user-avatar ${u.online ? "online" : "offline"}`}
      />
      <div className="jqzz-user-info">
        <div className="jqzz-user-name">
          {u.name}
          {u.id === viewerId && <span className="jqzz-annot jqzz-you">you</span>}
        </div>
        <div className="jqzz-user-handle">@{u.handle}</div>
      </div>
      <span
        className={`jqzz-online-dot ${u.online ? "on" : "off"}`}
        aria-label={u.online ? "online" : "offline"}
      />
    </div>
  );

  return (
    <div className="jqzz-people">
      <div className="jqzz-section-label">
        online <span className="jqzz-section-count">{online.length}</span>
      </div>
      {online.map(row)}
      {offline.length > 0 && (
        <>
          <div className="jqzz-section-label">
            offline <span className="jqzz-section-count">{offline.length}</span>
          </div>
          {offline.map((u, i) => row(u, online.length + i))}
        </>
      )}
    </div>
  );
};
