import React, { useMemo, useState } from "react";
import { usePeople } from "../../hooks/usePeople";
import { useFriends } from "../../hooks/useFriends";
import { playService } from "../../services/playService";
import { errorMessage } from "../../services/api";
import type { GameState } from "../../types/play";
import type { User } from "../../types";
import { Avatar } from "../common/Avatar";

interface Person {
  id: string;
  name: string;
  handle?: string;
  online: boolean;
  user: User;
}

/**
 * The host asks people in, from the lobby: friends first, then whoever is
 * online, then everyone else. Offline people can be asked too: it waits for
 * them as a notification, and they come in from there whenever they're back.
 */
export const InvitePeople: React.FC<{ game: GameState; me: string }> = ({ game, me }) => {
  const { users } = usePeople();
  const { friends } = useFriends();
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Record<string, "sending" | "sent" | string>>({});

  const groups = useMemo(() => {
    const inGame = new Set(game.players.map((p) => p.id));
    const byId = new Map(users.map((u) => [u.id, u]));
    const friendIds = new Set(friends.map((f) => f.id));
    const q = query.trim().toLowerCase();
    const keep = (p: Person) =>
      p.id !== me && !inGame.has(p.id) && (!q || `${p.name} ${p.handle ?? ""}`.toLowerCase().includes(q));
    const asPerson = (u: User): Person => ({ id: u.id, name: u.name, handle: u.handle, online: u.online, user: u });
    const byName = (a: Person, b: Person) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name);

    const friendList = friends
      .map((f) => asPerson(byId.get(f.id) ?? ({ ...f, profilePictureUrl: f.profilePictureUrl ?? undefined } as User)))
      .filter(keep)
      .sort(byName);
    const others = users.filter((u) => !friendIds.has(u.id)).map(asPerson).filter(keep);
    return [
      { key: "friends", label: "friends", people: friendList },
      { key: "online", label: "online", people: others.filter((p) => p.online).sort(byName) },
      { key: "offline", label: "offline", people: others.filter((p) => !p.online).sort(byName) },
    ];
  }, [users, friends, game.players, me, query]);

  const invite = (id: string) => {
    setSent((s) => ({ ...s, [id]: "sending" }));
    playService
      .invite(game.code, me, id)
      .then(() => setSent((s) => ({ ...s, [id]: "sent" })))
      .catch((err) => setSent((s) => ({ ...s, [id]: errorMessage(err) })));
  };

  const total = groups.reduce((n, g) => n + g.people.length, 0);
  return (
    <section className="jqzz-invite-people" aria-label="Invite people">
      <div className="jqzz-invite-head">
        <span className="jqzz-annot">or ask people in</span>
        <input
          className="jqzz-invite-search"
          type="search"
          value={query}
          placeholder="find someone"
          aria-label="Find someone to invite"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="jqzz-invite-groups">
        {total === 0 && <p className="jqzz-play-note">{query ? "nobody by that name" : "nobody else here yet"}</p>}
        {groups.map(
          (g) =>
            g.people.length > 0 && (
              <div key={g.key} className={`jqzz-invite-group is-${g.key}`}>
                <span className="jqzz-invite-label">
                  {g.label} <span className="jqzz-sid-count">{g.people.length}</span>
                </span>
                <ul>
                  {g.people.map((p, i) => {
                    const state = sent[p.id];
                    const failed = state && state !== "sending" && state !== "sent";
                    return (
                      <li key={p.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                        <span className={`jqzz-invite-face${p.online ? " online" : ""}`}>
                          <Avatar user={p.user} viewerId={me} className="jqzz-invite-avatar" />
                        </span>
                        <span className="jqzz-invite-name">
                          {p.name}
                          {failed && <span className="jqzz-invite-error">{state}</span>}
                        </span>
                        <button
                          className={`jqzz-play-btn small${state === "sent" ? " ghost" : " primary"}`}
                          disabled={state === "sending" || state === "sent"}
                          onClick={() => invite(p.id)}
                          title={p.online ? "they'll see it now" : "it waits for them until they're back"}
                        >
                          {state === "sent" ? "invited" : state === "sending" ? "…" : failed ? "again" : "invite"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
        )}
      </div>
    </section>
  );
};
