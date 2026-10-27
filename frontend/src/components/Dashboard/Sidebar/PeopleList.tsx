import React from "react";
import type { User } from "../../../types";
import { Avatar } from "../../common/Avatar";

interface PeopleListProps {
  users: User[];
  viewerId: string | undefined;
  /** your friends' ids: they come first */
  friendIds?: Set<string>;
  /** how many people asked to be your friend */
  requests?: number;
  /** a row opens that person's profile */
  onOpen?: (userId: string) => void;
}

/** Everyone on the server: your friends first, then whoever else is online, then the rest. */
export const PeopleList: React.FC<PeopleListProps> = ({ users, viewerId, friendIds, requests = 0, onOpen }) => {
  const byOnline = (a: User, b: User) => Number(b.online) - Number(a.online);
  const isFriend = (u: User) => !!friendIds?.has(u.id);
  const friends = users.filter(isFriend).sort(byOnline);
  const others = users.filter((u) => !isFriend(u));
  const online = others.filter((u) => u.online);
  const offline = others.filter((u) => !u.online);

  let n = 0;
  const row = (u: User) => (
    <button
      type="button"
      key={u.id}
      className={`jqzz-user-row${u.online ? "" : " is-offline"}${isFriend(u) ? " is-friend" : ""}`}
      style={{ "--i": n++ } as React.CSSProperties}
      onClick={() => onOpen?.(u.id)}
      title={`${u.name}'s profile`}
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
    </button>
  );

  const section = (label: string, list: User[], tone = "") =>
    list.length > 0 && (
      <>
        <div className={`jqzz-section-label${tone ? ` ${tone}` : ""}`}>
          {label} <span className="jqzz-section-count">{list.length}</span>
        </div>
        {list.map(row)}
      </>
    );

  return (
    <div className="jqzz-people">
      {users.length === 0 && <p className="jqzz-annot jqzz-people-empty">nobody yet</p>}
      {requests > 0 && onOpen && viewerId && (
        <button type="button" className="jqzz-people-requests" onClick={() => onOpen(viewerId)}>
          {requests === 1 ? "someone wants" : `${requests} people want`} to be your friend
        </button>
      )}
      {section("friends", friends, "friends")}
      {section("online", online)}
      {section("offline", offline)}
    </div>
  );
};
