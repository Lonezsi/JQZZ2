import React, { useState, useEffect } from "react";
import type { User } from "../../../types";
import { userService } from "../../../services/userService";
import { useWebSocket } from "../../../hooks/useWebSocket";

interface UserWebSocketMessage {
  event: string;
  user: User;
}

export const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    userService.getAll().then((res) => setUsers(res.data));
  }, []);

  useWebSocket<UserWebSocketMessage>("/topic/users", (msg) => {
    const { event, user } = msg;
    setUsers((prev) => {
      switch (event) {
        case "user_registered":
        case "user_logged_in":
        case "user_updated":
          return prev.map((u) => (u.id === user.id ? user : u));
        case "user_logged_out":
          return prev.map((u) =>
            u.id === user.id ? { ...u, online: false } : u,
          );
        default:
          return prev;
      }
    });
  });

  const sorted = [...users].sort((a, b) => Number(b.online) - Number(a.online));
  const online = sorted.filter((u) => u.online).length;
  const offline = sorted.length - online;

  return (
    <div>
      <div className="jqzz-stat-row">
        <div className="jqzz-stat-box">
          <div className="jqzz-stat-num" style={{ color: "var(--cyan)" }}>
            {online}
          </div>
          <div className="jqzz-stat-label">Online</div>
        </div>
        <div className="jqzz-stat-box">
          <div className="jqzz-stat-num" style={{ color: "var(--txt2)" }}>
            {offline}
          </div>
          <div className="jqzz-stat-label">Offline</div>
        </div>
      </div>

      {online > 0 && <div className="jqzz-section-label">Online</div>}
      {sorted
        .filter((u) => u.online)
        .map((u) => (
          <div key={u.id} className="jqzz-user-row">
            <div className="jqzz-user-avatar online">
              {u.name[0].toUpperCase()}
            </div>
            <div className="jqzz-user-info">
              <div className="jqzz-user-name">{u.name}</div>
              <div className="jqzz-user-handle">{u.handle}</div>
            </div>
            <div className="jqzz-online-dot on" />
          </div>
        ))}

      {offline > 0 && (
        <div
          className="jqzz-section-label"
          style={{ marginTop: online > 0 ? 14 : 0 }}
        >
          Offline
        </div>
      )}
      {sorted
        .filter((u) => !u.online)
        .map((u) => (
          <div key={u.id} className="jqzz-user-row">
            <div className="jqzz-user-avatar offline">
              {u.name[0].toUpperCase()}
            </div>
            <div className="jqzz-user-info">
              <div className="jqzz-user-name" style={{ color: "var(--txt2)" }}>
                {u.name}
              </div>
              <div className="jqzz-user-handle">{u.handle}</div>
            </div>
            <div className="jqzz-online-dot off" />
          </div>
        ))}
    </div>
  );
};
