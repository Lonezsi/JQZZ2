import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePresence } from "../../hooks/usePresence";
import { errorMessage } from "../../services/api";
import { profileService, stashService } from "../../services/stashService";
import type { Profile, StashItem } from "../../types/stash";
import { typeLabel } from "../../utils/questionInfo";
import { plural } from "../../utils/format";
import { readContent } from "../../utils/stashContent";
import { PlayFrame } from "../Play/PlayCommon";
import { Avatar } from "../common/Avatar";
import { BackButton } from "../common/BackButton";
import { IdentityModal } from "../Modals/IdentityModal";
import { GameList } from "./HistoryPage";
import { StashShelf } from "./StashShelf";
import { RefChip } from "./StashBits";

type Tab = "history" | "stash" | "shelf";

/**
 * Someone's page. Yours holds your history and your stash, each its own
 * space: history in the cool blue of answers, the stash in the warm light of
 * explanations. Someone else's shows the games you were both in and what
 * they made public.
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
  const tabs: Tab[] = self ? ["history", "stash"] : ["history", "shelf"];
  const tab: Tab = tabs.includes(fromRoute as Tab) ? (fromRoute as Tab) : "history";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const edit = usePresence(editing, 240);

  const load = useCallback(() => {
    if (!me || !id) return;
    profileService
      .get(me, id)
      .then(setProfile)
      .catch((err) => setError(errorMessage(err)));
  }, [me, id]);
  useEffect(load, [load]);

  const base = self ? "#/me" : `#/u/${id}`;
  const space = tab === "history" ? "history" : "stash";

  return (
    <PlayFrame phase={space === "history" ? "ANSWER" : "ELABORATION"}>
      <div className={`jqzz-space jqzz-space-${space}`}>
        <header className="jqzz-play-bar compact">
          <BackButton />
          <span className="jqzz-play-title">{self ? "you" : (profile?.user.name ?? "someone")}</span>
          {self && (
            <button className="jqzz-play-btn small ghost" onClick={() => setEditing(true)}>
              edit
            </button>
          )}
        </header>

        <main className="jqzz-shelf">
          {error && <p className="jqzz-play-note bad">{error}</p>}
          {profile && (
            <section className="jqzz-hero">
              <Avatar
                user={{ ...profile.user, profilePictureUrl: profile.user.profilePictureUrl ?? undefined }}
                viewerId={me}
                className="jqzz-hero-face"
              />
              <div className="jqzz-hero-who">
                <h1 className="OEF jqzz-chroma jqzz-hero-name">{profile.user.name}</h1>
                <span className="jqzz-annot">@{profile.user.handle}</span>
                {self && (
                  <span className="jqzz-hero-id">
                    <RefChip reference={profile.user.id} me="" label="your id" />
                    <span className="jqzz-annot">type it on another device to be you there</span>
                  </span>
                )}
              </div>
              <Stats profile={profile} />
            </section>
          )}

          <nav
            className="jqzz-glide jqzz-space-tabs"
            aria-label="Sections"
            style={{ "--n": tabs.length, "--at": tabs.indexOf(tab) } as React.CSSProperties}
          >
            <span className="jqzz-glide-thumb" aria-hidden="true" />
            {tabs.map((t) => (
              <a key={t} href={`${base}/${t}`} aria-current={t === tab ? "page" : undefined}>
                {t === "history" ? (self ? "history" : "games together") : t === "stash" ? "stash" : "their shelf"}
              </a>
            ))}
          </nav>

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
          {tab === "shelf" && profile && <Shelf items={profile.shelf} me={me} />}
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

const Stats: React.FC<{ profile: Profile }> = ({ profile }) => {
  const s = profile.stats;
  const cells: [string, string | number][] = [
    ["games", s.games],
    ["wins", s.wins],
    ["podiums", s.podiums],
    ["avg place", s.avgRank ?? "–"],
    ["points", s.points],
  ];
  const best = s.byType.filter((t) => t.questions > 0 && t.points > 0).slice(0, 3);
  return (
    <div className="jqzz-stats">
      <dl className="jqzz-stat-row">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dd>{value}</dd>
            <dt className="jqzz-annot">{label}</dt>
          </div>
        ))}
      </dl>
      {best.length > 0 && (
        <p className="jqzz-best">
          <span className="jqzz-annot">best at</span>
          {best.map((t) => (
            <span key={t.type} className="jqzz-type-pill" title={`${t.points} points over ${plural(t.questions, "question")}`}>
              {typeLabel(t.type)} · {Math.round(t.points / t.questions)}/q
            </span>
          ))}
        </p>
      )}
    </div>
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
