import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { go } from "../../hooks/useHashRoute";

interface Invite {
  code: string;
  from: string;
  quizName: string;
}

/**
 * Someone started a rematch of a game you were in: a card in the corner,
 * wherever you are in the app, with the way in.
 */
export const Invites: React.FC = () => {
  const { user } = useAuth();
  const { subscribe } = useWebSocket();
  const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!user) return;
    const sub = subscribe(`/topic/invite/${user.id}`, (msg) => {
      try {
        const invite = JSON.parse(msg.body) as Invite;
        setInvites((list) => [...list.filter((i) => i.code !== invite.code), invite].slice(-3));
      } catch {
        /* not an invite */
      }
    });
    return () => sub?.unsubscribe();
  }, [user, subscribe]);

  if (invites.length === 0) return null;
  const dismiss = (code: string) => setInvites((list) => list.filter((i) => i.code !== code));
  return (
    <div className="jqzz-invites" role="status" aria-live="polite">
      {invites.map((i) => (
        <div key={i.code} className="jqzz-invite">
          <span className="jqzz-annot">rematch</span>
          <span className="jqzz-invite-text">
            <b>{i.from}</b> is playing <b>{i.quizName}</b> again
          </span>
          <div className="jqzz-play-row">
            <button
              className="jqzz-play-btn small primary"
              onClick={() => {
                dismiss(i.code);
                go(`/join/${i.code}`);
              }}
            >
              join
            </button>
            <button className="jqzz-play-btn small ghost" onClick={() => dismiss(i.code)}>
              not now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
