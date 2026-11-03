import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { errorMessage } from "../../services/api";
import { quizService } from "../../services/quizService";
import {
  adminService,
  adminToken,
  type AdminGame,
  type AdminImage,
  type AdminOverview,
  type AdminQuiz,
  type AdminRecord,
  type AdminStashItem,
  type AdminUser,
  type Visibility,
} from "../../services/adminService";
import type { Question, Quiz } from "../../types";
import { plural, when } from "../../utils/format";
import { hits } from "../../utils/search";
import { convertToBackendQuiz } from "../../utils/quizConverter";
import { PlayFrame } from "../Play/PlayCommon";
import { BackButton } from "../common/BackButton";
import { Glide } from "../common/Glide";
import { Glyph } from "../common/Glyph";
import { SecretId } from "../common/SecretId";
import axios from "axios";

type Tab = "people" | "quizzes" | "games" | "history" | "pictures" | "stash" | "announce";

const TABS: { key: Tab; icon: string }[] = [
  { key: "people", icon: "FRIENDS" },
  { key: "quizzes", icon: "QUIZ" },
  { key: "games", icon: "TARGET" },
  { key: "history", icon: "HISTORY" },
  { key: "pictures", icon: "IMAGE" },
  { key: "stash", icon: "STASH" },
  { key: "announce", icon: "BELL" },
];

/**
 * The admin panel, at #/admin. Only the admin account gets past the door: it
 * asks the second question, and the answer buys a token for this tab. Behind
 * it, everyone's people, quizzes, games, history, pictures and stash, to see
 * and to change. Anyone else sees what the server tells them: nothing here.
 */
export const AdminPage: React.FC<{ tab?: string }> = ({ tab: fromRoute }) => {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(() => !!adminToken());
  const lock = useCallback(() => {
    adminService.lock();
    setUnlocked(false);
  }, []);
  // a token that ran out, or the server restarted: back to the question
  const failed = useCallback((err: unknown) => {
    if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 404)) {
      adminService.forget();
      setUnlocked(false);
    }
    return errorMessage(err);
  }, []);

  return (
    <PlayFrame phase="QUESTION">
      <div className="jqzz-space jqzz-space-you">
        <main className="jqzz-shelf jqzz-admin">
          <div className="jqzz-admin-head">
            <BackButton />
            <h1 className="OEF jqzz-chroma jqzz-admin-title">admin</h1>
            {unlocked && (
              <button className="jqzz-play-btn small ghost" onClick={lock}>
                lock
              </button>
            )}
          </div>
          {!user ? (
            <p className="jqzz-shelf-empty">nothing here.</p>
          ) : unlocked ? (
            <Panel tab={fromRoute} failed={failed} />
          ) : (
            <Door onOpen={() => setUnlocked(true)} />
          )}
        </main>
      </div>
    </PlayFrame>
  );
};

/** the second question; the server says 404 to anyone but the admin account */
const Door: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [question, setQuestion] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminService
      .question()
      // anything but the question (a page instead of the API, say) is a door that isn't there
      .then((q) => (typeof q === "string" ? setQuestion(q) : setMissing(true)))
      .catch(() => setMissing(true));
  }, []);
  if (missing) return <p className="jqzz-shelf-empty">nothing here.</p>;
  if (!question) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer || busy) return;
    setBusy(true);
    setError(null);
    adminService
      .unlock(answer)
      .then(onOpen)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => {
        setBusy(false);
        setAnswer("");
      });
  };
  return (
    <form className="jqzz-admin-door" onSubmit={submit}>
      <label className="jqzz-field-label" htmlFor="jqzz-admin-answer">
        {question.toLowerCase()}
      </label>
      <input
        id="jqzz-admin-answer"
        className="jqzz-field-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      {error && (
        <p className="jqzz-play-note bad" role="alert">
          {error}
        </p>
      )}
      <button className="jqzz-play-btn primary" type="submit" disabled={!answer || busy}>
        {busy ? "checking" : "unlock"}
      </button>
    </form>
  );
};

type Failed = (err: unknown) => string;

const Panel: React.FC<{ tab?: string; failed: Failed }> = ({ tab: fromRoute, failed }) => {
  const tab: Tab = TABS.some((t) => t.key === fromRoute) ? (fromRoute as Tab) : "people";
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [search, setSearch] = useState<{ tab: Tab; q: string }>({ tab, q: "" });
  const query = search.tab === tab ? search.q : "";
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => setStamp((s) => s + 1), []);
  useEffect(() => {
    adminService.overview().then(setOverview).catch(failed);
  }, [stamp, failed]);

  const count: Partial<Record<Tab, number>> = overview
    ? {
        people: overview.users,
        quizzes: overview.quizzes,
        games: overview.games,
        history: overview.records,
        pictures: overview.images,
        stash: overview.stash,
      }
    : {};

  const props = { query, failed, refresh, stamp };
  return (
    <>
      {overview && (
        <p className="jqzz-annot jqzz-admin-glance">
          {plural(overview.users, "person", "people")} · {overview.online} online · {plural(overview.liveGames, "game")}{" "}
          under way
        </p>
      )}
      <div className="jqzz-space-bar">
        <Glide
          className="jqzz-space-tabs jqzz-admin-tabs"
          label="Sections"
          value={tab}
          options={TABS.map((t) => ({
            key: t.key,
            href: `#/admin/${t.key}`,
            icon: t.icon,
            label: t.key,
            extra: count[t.key] !== undefined ? <span className="jqzz-annot">{count[t.key]}</span> : undefined,
          }))}
        />
        {tab !== "announce" && (
          <label className="jqzz-search jqzz-space-search">
            <span className="jqzz-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={`search ${tab}`}
              aria-label={`Search ${tab}`}
              onChange={(e) => setSearch({ tab, q: e.target.value })}
              onKeyDown={(e) => e.key === "Escape" && setSearch({ tab, q: "" })}
            />
          </label>
        )}
      </div>
      {tab === "people" && <People {...props} />}
      {tab === "quizzes" && <Quizzes {...props} />}
      {tab === "games" && <Games {...props} />}
      {tab === "history" && <History {...props} />}
      {tab === "pictures" && <Pictures {...props} />}
      {tab === "stash" && <Stash {...props} />}
      {tab === "announce" && <Announce failed={failed} />}
    </>
  );
};

interface ListProps {
  query: string;
  failed: Failed;
  refresh: () => void;
  stamp: number;
}

/** loads a list, again whenever something changed it */
function useList<T>(load: () => Promise<T[]>, failed: Failed, stamp: number) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    load()
      .then((x) => live && (setItems(x), setError(null)))
      .catch((err) => live && setError(failed(err)));
    return () => {
      live = false;
    };
  }, [load, failed, stamp]);
  return { items, error };
}

/** runs a change, says what went wrong, and reloads */
function useAct(failed: Failed, refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = useCallback(
    (p: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      return p()
        .then(refresh)
        .catch((err) => setError(failed(err)))
        .finally(() => setBusy(false));
    },
    [failed, refresh],
  );
  return { busy, error, act };
}

const Rows: React.FC<{
  items: unknown[] | null;
  shown: number;
  error: string | null;
  empty: string;
  children: React.ReactNode;
}> = ({ items, shown, error, empty, children }) => {
  if (error) return <p className="jqzz-play-note bad">{error}</p>;
  if (!items) return <p className="jqzz-shelf-empty">loading</p>;
  if (!shown) return <p className="jqzz-shelf-empty">{items.length ? "nothing matches that." : empty}</p>;
  return <ul className="jqzz-shelf-list">{children}</ul>;
};

/** asks once: the first press arms it, a second within three seconds does it */
const Armed: React.FC<{
  label: string;
  what: string;
  disabled?: boolean;
  /** a red button, for what can't be taken back */
  danger?: boolean;
  onFire: () => void;
}> = ({ label, what, disabled, danger = true, onFire }) => {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`jqzz-play-btn small ${danger ? "danger" : "ghost"}${armed ? " armed" : ""}`}
      disabled={disabled}
      aria-label={armed ? `Confirm: ${label} ${what}` : `${label} ${what}`}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
          return;
        }
        window.clearTimeout(timer.current);
        setArmed(false);
        onFire();
      }}
    >
      {armed ? `${label}?` : label}
    </button>
  );
};

// ─── people ──────────────────────────────────────────────────────────

const People: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const { items, error } = useList(adminService.users, failed, stamp);
  const shown = (items ?? []).filter((u) => hits(query, u.name, u.handle, u.email ?? ""));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="nobody yet.">
      {shown.map((u, i) => (
        <Person key={u.id} u={u} i={i} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const Person: React.FC<{ u: AdminUser; i: number; failed: Failed; refresh: () => void }> = ({
  u,
  i,
  failed,
  refresh,
}) => {
  const { busy, error, act } = useAct(failed, refresh);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.name);
  const [handle, setHandle] = useState(u.handle);
  const [email, setEmail] = useState(u.email ?? "");
  const [key, setKey] = useState<string | null>(null);
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">
          <a href={`#/u/${encodeURIComponent(u.id)}`}>{u.name}</a>
        </span>
        <span className="jqzz-annot">
          @{u.handle}
          {u.email && ` · ${u.email}`} · {plural(u.quizzes, "quiz", "quizzes")}
        </span>
        <div className="jqzz-shelf-answers">
          {u.online && <span className="good">online</span>}
          {u.googleLinked && <span>google</span>}
          {!u.hasKey && <span>no key yet</span>}
        </div>
      </div>
      {editing && (
        <form
          className="jqzz-admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => adminService.editUser(u.id, { name, handle, email })).then(() => setEditing(false));
          }}
        >
          <label>
            <span className="jqzz-field-label">name</span>
            <input className="jqzz-field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span className="jqzz-field-label">handle</span>
            <input className="jqzz-field-input" value={handle} onChange={(e) => setHandle(e.target.value)} />
          </label>
          <label>
            <span className="jqzz-field-label">email</span>
            <input className="jqzz-field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="jqzz-play-btn small primary" type="submit" disabled={busy}>
            save
          </button>
        </form>
      )}
      {key && (
        <div className="jqzz-admin-key">
          <span className="jqzz-field-label">their new login key. the old one no longer works</span>
          <SecretId id={key} />
        </div>
      )}
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      <div className="jqzz-shelf-actions">
        <button className="jqzz-play-btn small ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? "cancel" : "edit"}
        </button>
        <Armed
          label="new key"
          what={`for ${u.name}`}
          danger={false}
          disabled={busy}
          onFire={() => act(() => adminService.newKey(u.id).then(setKey))}
        />
        <Armed label="delete" what={u.name} disabled={busy} onFire={() => act(() => adminService.deleteUser(u.id))} />
      </div>
    </li>
  );
};

// ─── quizzes ─────────────────────────────────────────────────────────

const Quizzes: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const { items, error } = useList(adminService.quizzes, failed, stamp);
  const people = useList(adminService.users, failed, stamp).items ?? [];
  const shown = (items ?? []).filter((q) => hits(query, q.name, q.authorName ?? ""));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="no quizzes yet.">
      {shown.map((q, i) => (
        <QuizRow key={q.id} q={q} i={i} people={people} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const QuizRow: React.FC<{
  q: AdminQuiz;
  i: number;
  people: AdminUser[];
  failed: Failed;
  refresh: () => void;
}> = ({ q, i, people, failed, refresh }) => {
  const { busy, error, act } = useAct(failed, refresh);
  const [script, setScript] = useState<{ quiz: Quiz; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const open = () =>
    Promise.all([quizService.getOne(q.id), import("../../utils/scriptSerializer")])
      .then(([res, { quizToScript }]) => setScript({ quiz: res.data, text: quizToScript(res.data) }))
      .catch((err) => setProblems([errorMessage(err)]));
  const save = async () => {
    if (!script) return;
    const { parseScript } = await import("../../utils/scriptParser");
    const before: Question[] = [];
    script.quiz.actions.forEach((a) => a.question && !before.some((b) => b.id === a.question!.id) && before.push(a.question));
    const { actions, errors } = parseScript(script.text, before);
    setProblems(errors);
    if (errors.length) return;
    act(() => adminService.putQuiz(q.id, convertToBackendQuiz({ ...script.quiz, actions }))).then(() => setScript(null));
  };
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{q.name}</span>
        <span className="jqzz-annot">
          #{q.id} · {plural(q.questions, "question")} · by {q.authorName ?? "nobody"}
        </span>
      </div>
      <div className="jqzz-shelf-id">
        <select
          className="jqzz-field-input jqzz-shelf-pick"
          aria-label={`Author of ${q.name}`}
          value={q.authorId ?? ""}
          disabled={busy}
          onChange={(e) => act(() => adminService.editQuiz(q.id, { authorId: e.target.value }))}
        >
          {!q.authorId && <option value="">nobody</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} @{p.handle}
            </option>
          ))}
        </select>
      </div>
      {script && (
        <div className="jqzz-admin-script">
          <input
            className="jqzz-field-input"
            aria-label="Quiz name"
            value={script.quiz.name}
            onChange={(e) => setScript({ ...script, quiz: { ...script.quiz, name: e.target.value } })}
          />
          <textarea
            className="jqzz-field-textarea jqzz-admin-textarea"
            aria-label={`Script of ${q.name}`}
            spellCheck={false}
            value={script.text}
            onChange={(e) => setScript({ ...script, text: e.target.value })}
          />
        </div>
      )}
      {problems.length > 0 && (
        <ul className="jqzz-play-note bad jqzz-admin-msg">
          {problems.slice(0, 6).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      <div className="jqzz-shelf-actions">
        {script ? (
          <>
            <button className="jqzz-play-btn small ghost" onClick={() => (setScript(null), setProblems([]))}>
              cancel
            </button>
            <button className="jqzz-play-btn small primary" onClick={save} disabled={busy}>
              save script
            </button>
          </>
        ) : (
          <button className="jqzz-play-btn small ghost" onClick={open}>
            <Glyph name="PEN" size={12} /> edit script
          </button>
        )}
        <Armed label="delete" what={q.name} disabled={busy} onFire={() => act(() => adminService.deleteQuiz(q.id))} />
      </div>
    </li>
  );
};

// ─── games under way ─────────────────────────────────────────────────

const Games: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const [tick, setTick] = useState(0);
  // games move on their own: look again every few seconds
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 4000);
    return () => window.clearInterval(t);
  }, []);
  const { items, error } = useList(adminService.games, failed, stamp + tick);
  const shown = (items ?? []).filter((g) => hits(query, g.code, g.quizName, g.hostName ?? "", ...g.players.map((p) => p.name)));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="no games on the server right now.">
      {shown.map((g, i) => (
        <GameRow key={g.code} g={g} i={i} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const GameRow: React.FC<{ g: AdminGame; i: number; failed: Failed; refresh: () => void }> = ({
  g,
  i,
  failed,
  refresh,
}) => {
  const { busy, error, act } = useAct(failed, refresh);
  const control = (action: string, playerId?: string) => act(() => adminService.control(g.code, action, playerId));
  const over = g.status === "FINISHED";
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{g.quizName}</span>
        <span className="jqzz-annot">
          {g.code} · {g.status.toLowerCase()} · hosted by {g.hostName ?? "someone gone"} · {when(new Date(g.touchedAt).toISOString())}
        </span>
        <div className="jqzz-shelf-answers">
          {g.players.length === 0 && <span>no players</span>}
          {g.players.map((p) => (
            <span key={p.id} className="jqzz-admin-player">
              {p.name}
              {!over && (
                <button
                  className="jqzz-admin-kick"
                  disabled={busy}
                  onClick={() => control("kick", p.id)}
                  aria-label={`Kick ${p.name}`}
                  title={`kick ${p.name}`}
                >
                  <Glyph name="CLOSE" size={9} />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      {!over && (
        <div className="jqzz-shelf-actions">
          {g.status === "LOBBY" && (
            <button className="jqzz-play-btn small ghost" disabled={busy} onClick={() => control("start")}>
              start
            </button>
          )}
          {g.status === "PLAYING" && (
            <button className="jqzz-play-btn small ghost" disabled={busy} onClick={() => control("pause")}>
              pause
            </button>
          )}
          {g.status === "PAUSED" && (
            <button className="jqzz-play-btn small ghost" disabled={busy} onClick={() => control("resume")}>
              resume
            </button>
          )}
          {g.status !== "LOBBY" && (
            <button className="jqzz-play-btn small ghost" disabled={busy} onClick={() => control("skip")}>
              skip step
            </button>
          )}
          <Armed label="end" what={`game ${g.code}`} disabled={busy} onFire={() => control("end")} />
        </div>
      )}
    </li>
  );
};

// ─── history ─────────────────────────────────────────────────────────

const History: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const { items, error } = useList(adminService.history, failed, stamp);
  const shown = (items ?? []).filter((r) => hits(query, r.quizName, r.code, r.hostName ?? "", ...r.players.map((p) => p.name)));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="no finished games yet.">
      {shown.map((r, i) => (
        <RecordRow key={r.id} r={r} i={i} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const RecordRow: React.FC<{ r: AdminRecord; i: number; failed: Failed; refresh: () => void }> = ({
  r,
  i,
  failed,
  refresh,
}) => {
  const { busy, error, act } = useAct(failed, refresh);
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{r.quizName}</span>
        <span className="jqzz-annot">
          {r.code} · hosted by {r.hostName ?? "someone gone"}
          {r.finishedAt && ` · ${when(r.finishedAt)}`}
        </span>
        <div className="jqzz-shelf-answers">
          {r.players.map((p) => (
            <span key={`${p.ranking}-${p.name}`} className={p.ranking === 1 ? "good" : undefined}>
              {p.ranking}. {p.name} {p.score}
            </span>
          ))}
        </div>
      </div>
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      <div className="jqzz-shelf-actions">
        <Armed
          label="delete"
          what={`the record of ${r.quizName}`}
          disabled={busy}
          onFire={() => act(() => adminService.deleteRecord(r.id))}
        />
      </div>
    </li>
  );
};

// ─── pictures ────────────────────────────────────────────────────────

const VISIBILITIES: Visibility[] = ["PUBLIC", "SEMI_PRIVATE", "PRIVATE"];
const visibilityLabel = (v: Visibility) => v.toLowerCase().replace("_", "-");

const Pictures: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const { items, error } = useList(adminService.images, failed, stamp);
  const shown = (items ?? []).filter((m) => hits(query, m.handle, m.uploadedBy ?? "", m.visibility));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="no pictures yet.">
      {shown.map((m, i) => (
        <PictureRow key={m.id} m={m} i={i} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const PictureRow: React.FC<{ m: AdminImage; i: number; failed: Failed; refresh: () => void }> = ({
  m,
  i,
  failed,
  refresh,
}) => {
  const { busy, error, act } = useAct(failed, refresh);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    adminService
      .imageUrl(m.id)
      .then((u) => setSrc((url = u)))
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [m.id]);
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      {src ? <img className="jqzz-shelf-thumb" src={src} alt="" /> : <span className="jqzz-shelf-thumb" />}
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{m.handle}</span>
        <span className="jqzz-annot">
          by {m.uploadedBy ?? "nobody known"} · {Math.max(1, Math.round(m.size / 1024))} KB
          {m.createdAt && ` · ${when(m.createdAt)}`}
        </span>
      </div>
      <div className="jqzz-shelf-id">
        <select
          className="jqzz-field-input jqzz-shelf-pick"
          aria-label={`Who can use ${m.handle}`}
          value={m.visibility}
          disabled={busy}
          onChange={(e) => act(() => adminService.imageVisibility(m.id, e.target.value as Visibility))}
        >
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {visibilityLabel(v)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      <div className="jqzz-shelf-actions">
        <Armed label="delete" what={m.handle} disabled={busy} onFire={() => act(() => adminService.deleteImage(m.id))} />
      </div>
    </li>
  );
};

// ─── stash ───────────────────────────────────────────────────────────

const Stash: React.FC<ListProps> = ({ query, failed, refresh, stamp }) => {
  const { items, error } = useList(adminService.stash, failed, stamp);
  const shown = (items ?? []).filter((s) => hits(query, s.title ?? "", s.handle, s.kind, s.savedBy ?? ""));
  return (
    <Rows items={items} shown={shown.length} error={error} empty="nothing stashed yet.">
      {shown.map((s, i) => (
        <StashRow key={s.id} s={s} i={i} failed={failed} refresh={refresh} />
      ))}
    </Rows>
  );
};

const StashRow: React.FC<{ s: AdminStashItem; i: number; failed: Failed; refresh: () => void }> = ({
  s,
  i,
  failed,
  refresh,
}) => {
  const { busy, error, act } = useAct(failed, refresh);
  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{s.title || s.handle}</span>
        <span className="jqzz-annot">
          {s.kind.toLowerCase()} · {s.handle} · {visibilityLabel(s.visibility)} · saved by {s.savedBy ?? "nobody known"}
          {s.createdAt && ` · ${when(s.createdAt)}`}
        </span>
      </div>
      {error && <p className="jqzz-play-note bad jqzz-admin-msg">{error}</p>}
      <div className="jqzz-shelf-actions">
        <Armed
          label="delete"
          what={s.title || s.handle}
          disabled={busy}
          onFire={() => act(() => adminService.deleteStash(s.id))}
        />
      </div>
    </li>
  );
};

// ─── telling everyone ────────────────────────────────────────────────

const Announce: React.FC<{ failed: Failed }> = ({ failed }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="jqzz-admin-announce"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        adminService
          .announce(text.trim())
          .then((n) => {
            setNote({ ok: true, text: `sent to ${plural(n, "person", "people")}.` });
            setText("");
          })
          .catch((err) => setNote({ ok: false, text: failed(err) }))
          .finally(() => setBusy(false));
      }}
    >
      <label className="jqzz-field-label" htmlFor="jqzz-admin-announce">
        a notification for everyone <span className="jqzz-optional">{text.length}/500</span>
      </label>
      <textarea
        id="jqzz-admin-announce"
        className="jqzz-field-textarea"
        rows={4}
        maxLength={500}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {note && <p className={`jqzz-play-note ${note.ok ? "good" : "bad"}`}>{note.text}</p>}
      <button className="jqzz-play-btn primary" type="submit" disabled={!text.trim() || busy}>
        {busy ? "sending" : "send to everyone"}
      </button>
    </form>
  );
};
