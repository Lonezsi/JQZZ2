import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePresence } from "../../hooks/usePresence";
import { useFriends } from "../../hooks/useFriends";
import { errorMessage } from "../../services/api";
import { profileService, stashService } from "../../services/stashService";
import type { FriendPerson } from "../../services/friendService";
import type { Profile, StashItem } from "../../types/stash";
import { QUESTION_TYPE_LABEL, typeLabel } from "../../utils/questionInfo";
import { plural, when } from "../../utils/format";
import { readContent } from "../../utils/stashContent";
import { PlayFrame } from "../Play/PlayCommon";
import { Avatar } from "../common/Avatar";
import { BackButton } from "../common/BackButton";
import { Glyph } from "../common/Glyph";
import { IdentityModal } from "../Modals/IdentityModal";
import { GameList } from "./HistoryPage";
import { StashShelf } from "./StashShelf";
import { NotificationList } from "./NotificationList";
import { RefChip } from "./StashBits";
import { Glide } from "../common/Glide";

type Tab = "history" | "stash" | "you" | "shelf" | "friends" | "notifications";

/**
 * Someone's page, laid out like a profile: a cover, their face over its
 * edge, who they are, how they play. Yours holds your history, your stash
 * and an "about you" card; editing is the pen in the corner. Someone else's
 * shows the games you played together, what they made public, their friends,
 * and the button to become friends.
 */
export const ProfilePage: React.FC<{
  userId?: string;
  tab?: string;
  sub?: string;
  add?: { kind: string; ref: string };
}> = ({ userId, tab: fromRoute, sub, add }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const id = userId || me;
  const self = id === me;
  const tabs: Tab[] = self ? ["history", "stash", "notifications", "you"] : ["history", "shelf", "friends"];
  const tab: Tab = tabs.includes(fromRoute as Tab) ? (fromRoute as Tab) : "history";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const edit = usePresence(editing, 240);
  const friends = useFriends();

  const load = useCallback(() => {
    if (!me || !id) return;
    profileService
      .get(me, id)
      .then((p) => {
        setProfile(p);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [me, id]);
  // loads, and loads again when a friend request is answered from either side
  // a friend request answered from either side shows here straight away
  useEffect(load, [load, friends.friends.length, friends.incoming.length, friends.outgoing.length]);

  const base = self ? "#/me" : `#/u/${encodeURIComponent(id)}`;
  const space = tab === "history" ? "history" : tab === "you" || tab === "friends" || tab === "notifications" ? "you" : "stash";
  const face = profile && { ...profile.user, profilePictureUrl: profile.user.profilePictureUrl ?? undefined };

  return (
    <PlayFrame phase={space === "history" ? "ANSWER" : space === "you" ? "QUESTION" : "ELABORATION"}>
      <div className={`jqzz-space jqzz-space-${space}`}>
        <main className="jqzz-shelf jqzz-profile">
          <section className="jqzz-pcard" aria-label={profile ? `${profile.user.name}'s profile` : "Profile"}>
            <div className="jqzz-pcard-cover" aria-hidden="true">
              {face && <Avatar user={face} viewerId={me} className="jqzz-pcard-cover-face" />}
            </div>
            <div className="jqzz-pcard-top">
              <BackButton />
              {self && (
                <button
                  className="jqzz-pcard-pen"
                  onClick={() => setEditing(true)}
                  title="edit you"
                  aria-label="Edit your name, handle and picture"
                >
                  <Glyph name="PEN" size={15} />
                </button>
              )}
            </div>
            <div className="jqzz-pcard-body">
              {face ? (
                <Avatar user={face} viewerId={me} className="jqzz-pcard-face" />
              ) : (
                <span className="jqzz-pcard-face" />
              )}
              <div className="jqzz-pcard-who">
                <h1 className="OEF jqzz-chroma jqzz-pcard-name">{profile?.user.name ?? " "}</h1>
                {profile && (
                  <p className="jqzz-pcard-line">
                    <span>@{profile.user.handle}</span>
                    <span aria-hidden="true">·</span>
                    <a href={`${base}/${self ? "you" : "friends"}`}>{plural(profile.friends.length, "friend")}</a>
                    {profile.joined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>playing since {when(profile.joined).split(",")[0]}</span>
                      </>
                    )}
                  </p>
                )}
              </div>
              {profile && !self && <FriendButton status={profile.friendship} otherId={id} friends={friends} />}
            </div>
            {error && <p className="jqzz-play-note bad">{error}</p>}
            {profile && <Stats profile={profile} />}
          </section>

          <Glide
            className="jqzz-space-tabs"
            label="Sections"
            value={tab}
            options={tabs.map((t) => ({
              key: t,
              href: `${base}/${t}`,
              icon:
                t === "history"
                  ? "HISTORY"
                  : t === "you"
                    ? "YOU"
                    : t === "friends"
                      ? "FRIENDS"
                      : t === "notifications"
                        ? "BELL"
                        : "STASH",
              label:
                t === "history"
                  ? self
                    ? "history"
                    : "games together"
                  : t === "shelf"
                    ? "their shelf"
                    : t === "you"
                      ? "about you"
                      : t,
            }))}
          />

          {tab === "history" && profile && (
            <GameList
              games={profile.games}
              me={me}
              empty={
                self ? (
                  <>
                    no games yet. games you host or play land here once they finish.{" "}
                    <a href="#/join">join one</a>
                  </>
                ) : (
                  "you haven't played a game together yet."
                )
              }
            />
          )}
          {tab === "stash" && self && <StashShelf tab={sub} add={add} />}
          {tab === "notifications" && self && <NotificationList />}
          {tab === "you" && self && profile && <AboutYou profile={profile} me={me} friends={friends} />}
          {tab === "shelf" && profile && <Shelf items={profile.shelf} me={me} />}
          {tab === "friends" && profile && (
            <FriendGrid people={profile.friends} me={me} empty="no friends here yet." />
          )}
        </main>
      </div>
      {edit.mounted && user && (
        <IdentityModal
          state={edit.state}
          current={user}
          onSave={() => {
            setEditing(false);
            load();
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </PlayFrame>
  );
};

type Friends = ReturnType<typeof useFriends>;

/** Add friend, requested, accept or decline, or friends: how you stand, and what you can do about it. */
const FriendButton: React.FC<{ status: Profile["friendship"]; otherId: string; friends: Friends }> = ({
  status,
  otherId,
  friends,
}) => {
  const [busy, setBusy] = useState(false);
  const run = (p: Promise<unknown>) => {
    setBusy(true);
    p.catch(() => {}).finally(() => setBusy(false));
  };
  if (status === "self") return null;
  if (status === "incoming") {
    return (
      <div className="jqzz-pcard-actions">
        <button className="jqzz-play-btn small primary" disabled={busy} onClick={() => run(friends.add(otherId))}>
          <Glyph name="CHECK" size={13} />
          accept
        </button>
        <button className="jqzz-play-btn small ghost" disabled={busy} onClick={() => run(friends.remove(otherId))}>
          decline
        </button>
      </div>
    );
  }
  if (status === "friends") {
    return (
      <div className="jqzz-pcard-actions">
        <button
          className="jqzz-play-btn small jqzz-friend-yes"
          disabled={busy}
          onClick={() => run(friends.remove(otherId))}
          title="press to unfriend"
        >
          <Glyph name="FRIENDS" size={13} />
          <span className="when-idle">friends</span>
          <span className="when-hover">unfriend</span>
        </button>
      </div>
    );
  }
  if (status === "outgoing") {
    return (
      <div className="jqzz-pcard-actions">
        <button className="jqzz-play-btn small" disabled={busy} onClick={() => run(friends.remove(otherId))} title="take it back">
          <Glyph name="CHECK" size={13} />
          requested
        </button>
      </div>
    );
  }
  return (
    <div className="jqzz-pcard-actions">
      <button className="jqzz-play-btn small primary" disabled={busy} onClick={() => run(friends.add(otherId))}>
        <Glyph name="FRIEND_ADD" size={13} />
        add friend
      </button>
    </div>
  );
};

/** Tiles for the numbers, and bars for what they're best at. */
const Stats: React.FC<{ profile: Profile }> = ({ profile }) => {
  const s = profile.stats;
  const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : null;
  const tiles: { label: string; value: string | number; icon: string; tone: string; note?: string }[] = [
    { label: "games", value: s.games, icon: "QUIZ", tone: "accent", note: s.hosted ? `${s.hosted} hosted` : undefined },
    { label: "wins", value: s.wins, icon: "TROPHY", tone: "warm", note: winRate !== null ? `${winRate}% of played` : undefined },
    { label: "podiums", value: s.podiums, icon: "RESULT", tone: "answer" },
    { label: "avg place", value: s.avgRank ?? "–", icon: "TARGET", tone: "question" },
    { label: "points", value: s.points.toLocaleString(), icon: "STAR", tone: "ok" },
  ];
  const best = s.byType.filter((t) => t.questions > 0 && t.points > 0).slice(0, 4);
  const top = Math.max(1, ...best.map((t) => t.points / t.questions));
  return (
    <div className="jqzz-stats">
      <ul className="jqzz-stat-tiles">
        {tiles.map((t, i) => (
          <li key={t.label} className={`tone-${t.tone}`} style={{ "--i": i } as React.CSSProperties}>
            <span className="jqzz-stat-icon" aria-hidden="true">
              <Glyph name={t.icon} size={15} />
            </span>
            <span className="jqzz-stat-value">{t.value}</span>
            <span className="jqzz-annot">{t.label}</span>
            {t.note && <span className="jqzz-stat-note">{t.note}</span>}
          </li>
        ))}
      </ul>
      {best.length > 0 && (
        <div className="jqzz-best">
          <span className="jqzz-annot">best at</span>
          <ul>
            {best.map((t) => {
              const per = Math.round(t.points / t.questions);
              return (
                <li key={t.type} title={`${t.points} points over ${plural(t.questions, "question")}`}>
                  <Glyph name={t.type} size={13} />
                  <span className="jqzz-best-name">{QUESTION_TYPE_LABEL[t.type] ?? typeLabel(t.type)}</span>
                  <span className="jqzz-best-bar">
                    <span style={{ width: `${(per / top) * 100}%` }} />
                  </span>
                  <span className="jqzz-annot">{per} / q</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

/** You, as others see you: details, friends, and the people asking to be. */
const AboutYou: React.FC<{ profile: Profile; me: string; friends: Friends }> = ({ profile, me, friends }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const answer = (otherId: string, accept: boolean) => {
    setBusy(otherId);
    (accept ? friends.add(otherId) : friends.remove(otherId)).catch(() => {}).finally(() => setBusy(null));
  };
  return (
    <div className="jqzz-about">
      <section className="jqzz-about-card">
        <h2 className="jqzz-annot">about</h2>
        <dl className="jqzz-about-list">
          <div>
            <dt>
              <Glyph name="YOU" size={14} />
              name
            </dt>
            <dd>{profile.user.name}</dd>
          </div>
          <div>
            <dt>
              <Glyph name="SEMI_PRIVATE" size={14} />
              handle
            </dt>
            <dd>@{profile.user.handle}</dd>
          </div>
          {user?.email && (
            <div>
              <dt>
                <Glyph name="QUIZ" size={14} />
                email
              </dt>
              <dd>{user.email}</dd>
            </div>
          )}
          <div>
            <dt>
              <Glyph name="PRIVATE" size={14} />
              your id
            </dt>
            <dd>
              <RefChip reference={profile.user.id} me="" label="copy" />
              <span className="jqzz-annot">type it on another device to be you there</span>
            </dd>
          </div>
        </dl>
      </section>

      {friends.incoming.length > 0 && (
        <section className="jqzz-about-card">
          <h2 className="jqzz-annot">want to be your friend · {friends.incoming.length}</h2>
          <ul className="jqzz-friend-grid">
            {friends.incoming.map((p) => (
              <li key={p.id} className="jqzz-friend">
                <PersonLink person={p} me={me} />
                <span className="jqzz-friend-actions">
                  <button
                    className="jqzz-play-btn small primary"
                    disabled={busy === p.id}
                    onClick={() => answer(p.id, true)}
                  >
                    <Glyph name="CHECK" size={13} />
                    accept
                  </button>
                  <button className="jqzz-play-btn small ghost" disabled={busy === p.id} onClick={() => answer(p.id, false)}>
                    decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="jqzz-about-card">
        <h2 className="jqzz-annot">friends · {friends.friends.length}</h2>
        <FriendGrid
          people={friends.friends}
          me={me}
          empty="no friends yet. open someone from the people list or a game and add them."
        />
        {friends.outgoing.length > 0 && (
          <p className="jqzz-annot jqzz-about-waiting">
            waiting on {friends.outgoing.map((p) => p.name).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
};

const PersonLink: React.FC<{ person: FriendPerson; me: string }> = ({ person, me }) => (
  <a className="jqzz-friend-who" href={`#/u/${encodeURIComponent(person.id)}`}>
    <Avatar
      user={{ ...person, profilePictureUrl: person.profilePictureUrl ?? undefined }}
      viewerId={me}
      className={`jqzz-friend-face${person.online ? " online" : ""}`}
    />
    <span className="jqzz-friend-text">
      <span className="jqzz-friend-name">{person.name}</span>
      <span className="jqzz-annot">{person.online ? "online" : `@${person.handle}`}</span>
    </span>
  </a>
);

const FriendGrid: React.FC<{ people: FriendPerson[]; me: string; empty: string }> = ({ people, me, empty }) => {
  if (people.length === 0) return <p className="jqzz-shelf-empty">{empty}</p>;
  const sorted = [...people].sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <ul className="jqzz-friend-grid">
      {sorted.map((p) => (
        <li key={p.id} className="jqzz-friend">
          <PersonLink person={p} me={me} />
        </li>
      ))}
    </ul>
  );
};

/** What someone else made public, ready to copy into your own stash. */
const Shelf: React.FC<{ items: StashItem[]; me: string }> = ({ items, me }) => {
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return <p className="jqzz-shelf-empty">nothing public yet.</p>;
  return (
    <>
      {error && <p className="jqzz-play-note bad">{error}</p>}
      <ul className="jqzz-shelf-list">
        {items.map((item, i) => {
          const content = readContent(item);
          return (
            <li key={item.id} className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <div className="jqzz-shelf-body">
                <span className="jqzz-shelf-title">{item.title || item.handle}</span>
                <span className="jqzz-annot">
                  {item.kind === "QUIZ"
                    ? `quiz · ${plural(content.questions.length, "question")}`
                    : item.kind === "QUESTION"
                      ? typeLabel(content.questions[0]?.type)
                      : item.kind === "TYPE"
                        ? "question type"
                        : "picture"}
                </span>
              </div>
              <RefChip reference={item.reference} me={me} />
              <button
                className="jqzz-play-btn small"
                disabled={copied.has(item.id)}
                onClick={() =>
                  stashService
                    .fromRef(me, item.kind, item.reference)
                    .then(() => setCopied((s) => new Set(s).add(item.id)))
                    .catch((err) => setError(errorMessage(err)))
                }
              >
                {copied.has(item.id) ? "in your stash ✓" : "copy in"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};
