import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuiz } from "../../contexts/QuizContext";
import { go } from "../../hooks/useHashRoute";
import { errorMessage } from "../../services/api";
import { imageUrl, shareLink, stashService } from "../../services/stashService";
import { quizService } from "../../services/quizService";
import { playService } from "../../services/playService";
import type { ImageVisibility } from "../../types";
import type { LibraryImage, StashItem, StashKind, StashList } from "../../types/stash";
import { typeLabel } from "../../utils/questionInfo";
import { contentToActions, readContent, readType } from "../../utils/stashContent";
import type { TypeShape } from "../../types/stash";
import type { Phase } from "../../types";
import { Glide } from "../common/Glide";
import { Glyph } from "../common/Glyph";
import { Select } from "../common/Select";
import { setTypesCache } from "../../hooks/useTypes";
import { QUESTION_TYPE_LABEL } from "../../utils/questionInfo";
import { QuestionImage } from "../Play/PlayCommon";
import { ConfirmButton, RefChip, VisibilitySwitch } from "./StashBits";
import { plural, when } from "../../utils/format";

type Tab = "quizzes" | "questions" | "types" | "images" | "browse";
const TABS: { tab: Tab; kind: StashKind | null; label: string; icon: string }[] = [
  { tab: "quizzes", kind: "QUIZ", label: "quizzes", icon: "QUIZ" },
  { tab: "questions", kind: "QUESTION", label: "questions", icon: "ITEM_QUESTION" },
  { tab: "types", kind: "TYPE", label: "types", icon: "TYPE" },
  { tab: "images", kind: "IMAGE", label: "images", icon: "IMAGE" },
  { tab: "browse", kind: null, label: "browse", icon: "BROWSE" },
];

const KINDS: Record<string, StashKind> = { quiz: "QUIZ", question: "QUESTION", image: "IMAGE", type: "TYPE" };

/**
 * Everything you saved: whole quizzes, single questions, pictures. Each has an
 * id like the image library's: ":name" for you, "yourid:name" for others when
 * shared, just "name" once public. Lives on your profile, under "stash".
 *
 * add: arrived through a share link, #/stash/add/quiz/theirid:name
 */
export const StashShelf: React.FC<{ tab?: string; add?: { kind: string; ref: string } }> = ({
  tab: fromRoute,
  add,
}) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const addKind = add ? KINDS[add.kind] : undefined;
  const tab =
    TABS.find((t) => t.tab === fromRoute) ?? (addKind && TABS.find((t) => t.kind === addKind)) ?? TABS[0];
  const [data, setData] = useState<StashList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const followed = useRef<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    stashService
      .list(me)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [me]);

  const put = useCallback(
    (item: StashItem) =>
      setData((d) =>
        d && {
          ...d,
          items: d.items.some((i) => i.id === item.id)
            ? d.items.map((i) => (i.id === item.id ? item : i))
            : [item, ...d.items],
        },
      ),
    [],
  );
  const drop = useCallback(
    (id: number) => setData((d) => d && { ...d, items: d.items.filter((i) => i.id !== id) }),
    [],
  );
  const putImage = useCallback(
    (img: LibraryImage) =>
      setData((d) => d && { ...d, images: d.images.map((i) => (i.id === img.id ? img : i)) }),
    [],
  );

  // a share link copies its item in once, then tidies the address
  useEffect(() => {
    if (!me || !data || !add || !addKind) return;
    const key = `${addKind}|${add.ref}`;
    if (followed.current === key) return;
    followed.current = key;
    stashService
      .fromRef(me, addKind, add.ref)
      .then((item) => {
        put(item);
        setLinkNote({ text: `${item.title || item.handle} is in your stash now` });
      })
      .catch((err) => setLinkNote({ text: errorMessage(err), bad: true }))
      .finally(() => window.history.replaceState(null, "", `#/me/stash/${tab.tab}`));
  }, [me, data, add, addKind, put, tab.tab]);

  const items = useMemo(() => data?.items.filter((i) => i.kind === tab.kind) ?? [], [data, tab.kind]);

  // the add tray shows the same types: keep it in step with edits here
  useEffect(() => {
    if (data && me) setTypesCache(me, data.items.filter((i) => i.kind === "TYPE"));
  }, [data, me]);
  const counts = useMemo(() => {
    const c: Record<StashKind, number> = { QUIZ: 0, QUESTION: 0, TYPE: 0, IMAGE: data?.images.length ?? 0 };
    data?.items.forEach((i) => c[i.kind]++);
    return c;
  }, [data]);

  return (
    <div className="jqzz-shelf-body-wrap">
      <Glide
        className="jqzz-shelf-tabs"
        label="What you saved"
        value={tab.tab}
        options={TABS.map((t) => ({
          key: t.tab,
          label: t.label,
          icon: t.icon,
          href: `#/me/stash/${t.tab}`,
          extra: t.kind ? <span className="jqzz-annot">{counts[t.kind]}</span> : undefined,
        }))}
      />

      {linkNote && (
        <p className={`jqzz-play-note${linkNote.bad ? " bad" : ""} jqzz-shelf-linknote`} role="status">
          {linkNote.text}
        </p>
      )}
      {error && <p className="jqzz-play-note bad">{error}</p>}
      {!data && !error && <p className="jqzz-annot jqzz-shelf-empty">loading…</p>}

      {data && tab.tab === "browse" && <Browse me={me} onAdded={put} />}
      {data && tab.kind && tab.kind !== "TYPE" && <AddByRef kind={tab.kind} me={me} onAdded={put} />}
      {data && tab.kind === "TYPE" && <TypesTab types={items} me={me} put={put} drop={drop} reload={setData} />}
      {data && tab.kind === "IMAGE" && (
        <ImagesTab images={data.images} saved={items} me={me} put={put} drop={drop} putImage={putImage} />
      )}
      {data && (tab.kind === "QUIZ" || tab.kind === "QUESTION") && (
        <>
          {tab.kind === "QUESTION" && items.length >= 2 && <ShuffleQuiz questions={items} me={me} />}
          {items.length === 0 && (
            <p className="jqzz-shelf-empty">
              nothing here yet. finish a game and save {tab.kind === "QUIZ" ? "the quiz" : "a question"} from
              the final screen or from <a href="#/me/history">your history</a>, or browse what others shared.
            </p>
          )}
          <ul className="jqzz-shelf-list">
            {items.map((item, i) => (
              <StashRow key={item.id} item={item} me={me} index={i} put={put} drop={drop} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

/** Public quizzes and questions from everyone, to copy in. */
const Browse: React.FC<{ me: string; onAdded: (item: StashItem) => void }> = ({ me, onAdded }) => {
  const [kind, setKind] = useState<StashKind>("QUIZ");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<StashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      stashService
        .browse(kind, q)
        .then((r) => !cancelled && setFound(r))
        .catch((err) => !cancelled && setError(errorMessage(err)));
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [kind, q]);

  const kinds: StashKind[] = ["QUIZ", "QUESTION", "TYPE", "IMAGE"];
  return (
    <>
      <div className="jqzz-shelf-add">
        <Glide
          kind="radio"
          label="What to browse"
          value={kind}
          onPick={(k) => setKind(k as StashKind)}
          options={kinds.map((k) => ({
            key: k,
            icon: k === "QUESTION" ? "ITEM_QUESTION" : k,
            label: k === "QUIZ" ? "quizzes" : k === "QUESTION" ? "questions" : k === "TYPE" ? "types" : "images",
          }))}
        />
        <input
          className="jqzz-field-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search public ones"
          aria-label="Search public items"
        />
      </div>
      {error && <p className="jqzz-play-note bad">{error}</p>}
      {found && found.length === 0 && <p className="jqzz-shelf-empty">nothing public matches that yet.</p>}
      <ul className="jqzz-shelf-list">
        {found?.map((item, i) => {
          const content = readContent(item);
          const mine = item.savedBy === me;
          return (
            <li key={item.id} className="jqzz-shelf-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              {item.kind === "IMAGE" && item.imageId != null && (
                <img className="jqzz-shelf-thumb" src={imageUrl(item.imageId, me)} alt="" loading="lazy" />
              )}
              <div className="jqzz-shelf-body">
                <span className="jqzz-shelf-title">{item.title || item.handle}</span>
                <span className="jqzz-annot">
                  {item.kind === "QUIZ"
                    ? plural(content.questions.length, "question")
                    : item.kind === "QUESTION"
                      ? typeLabel(content.questions[0]?.type)
                      : item.kind === "TYPE"
                        ? "question type"
                        : "picture"}
                  {` · `}
                  <a href={`#/u/${encodeURIComponent(item.savedBy)}`}>{mine ? "yours" : "whose is it"}</a>
                </span>
              </div>
              <RefChip reference={item.reference} me={me} />
              <button
                className="jqzz-play-btn small"
                disabled={mine || copied.has(item.id)}
                onClick={() =>
                  stashService
                    .fromRef(me, item.kind, item.reference)
                    .then((copy) => {
                      onAdded(copy);
                      setCopied((s) => new Set(s).add(item.id));
                    })
                    .catch((err) => setError(errorMessage(err)))
                }
              >
                {mine ? "yours" : copied.has(item.id) ? "copied ✓" : "copy in"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

/** A new quiz from a handful of your saved questions, picked at random. */
const ShuffleQuiz: React.FC<{ questions: StashItem[]; me: string }> = ({ questions, me }) => {
  const { addQuiz, setActiveQuizId } = useQuiz();
  const [count, setCount] = useState(Math.min(10, questions.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Math.min(count, questions.length);
  const make = () => {
    const picked = [...questions].sort(() => Math.random() - 0.5).slice(0, n);
    const actions = picked.flatMap((item) => contentToActions(readContent(item)));
    setBusy(true);
    quizService
      .create({ name: `shuffle of ${n}`, authorId: me, actions })
      .then((res) => {
        addQuiz(res.data);
        setActiveQuizId(res.data.id);
        go("/");
      })
      .catch((err) => {
        setError(errorMessage(err));
        setBusy(false);
      });
  };
  return (
    <div className="jqzz-shelf-add jqzz-shuffle">
      <span className="jqzz-annot">a quiz of</span>
      <input
        className="jqzz-field-input jqzz-shuffle-n"
        type="number"
        min={1}
        max={questions.length}
        value={n}
        onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
        aria-label="How many questions"
      />
      <span className="jqzz-annot">random questions from here</span>
      <button className="jqzz-play-btn small" onClick={make} disabled={busy}>
        {busy ? "making it…" : "make it"}
      </button>
      {error && <span className="jqzz-play-note bad">{error}</span>}
    </div>
  );
};

/** "id:name" or "name" from someone else, copied into your stash */
const AddByRef: React.FC<{ kind: StashKind; me: string; onAdded: (item: StashItem) => void }> = ({
  kind,
  me,
  onAdded,
}) => {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const noun = kind === "QUIZ" ? "quiz" : kind === "QUESTION" ? "question" : "image";
  return (
    <form
      className="jqzz-shelf-add"
      onSubmit={(e) => {
        e.preventDefault();
        const r = ref.trim();
        if (!r) return;
        setBusy(true);
        setNote(null);
        stashService
          .fromRef(me, kind, r)
          .then((item) => {
            onAdded(item);
            setRef("");
            setNote({ text: `saved as ${item.handle}` });
          })
          .catch((err) => setNote({ text: errorMessage(err), bad: true }))
          .finally(() => setBusy(false));
      }}
    >
      <input
        className="jqzz-field-input"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="name or theirid:name"
        aria-label={`Copy a ${noun} into your stash by its id`}
        spellCheck={false}
        autoComplete="off"
      />
      <button className="jqzz-play-btn small" disabled={busy || !ref.trim()}>
        {busy ? "copying…" : "copy in"}
      </button>
      {note && (
        <span className={`jqzz-play-note${note.bad ? " bad" : ""}`} role="status">
          {note.text}
        </span>
      )}
    </form>
  );
};

/** id, who can reach it, rename and remove: the same for every kind */
function useItemControls(item: StashItem, me: string, put: (i: StashItem) => void, drop: (id: number) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => {
    setBusy(true);
    setError(null);
    return p.catch((err) => setError(errorMessage(err))).finally(() => setBusy(false));
  };
  return {
    busy,
    error,
    setError,
    run,
    setVisibility: (visibility: ImageVisibility) =>
      run(stashService.update(me, item.id, { visibility }).then(put)),
    rename: (handle: string) => run(stashService.update(me, item.id, { handle }).then(put)),
    remove: () => run(stashService.remove(me, item.id).then(() => drop(item.id))),
  };
}

const StashRow: React.FC<{
  item: StashItem;
  me: string;
  index: number;
  put: (i: StashItem) => void;
  drop: (id: number) => void;
}> = ({ item, me, index, put, drop }) => {
  const { quizzes, addQuiz, appendActions, setActiveQuizId } = useQuiz();
  const c = useItemControls(item, me, put, drop);
  const [renaming, setRenaming] = useState(false);
  const [added, setAdded] = useState<{ id: number; name: string } | null>(null);
  const content = useMemo(() => readContent(item), [item]);
  const mine = quizzes.filter((q) => q.authorId === me);
  const first = content.questions[0];

  const open = () =>
    c.run(
      stashService.open(me, item.id).then((quiz) => {
        addQuiz(quiz);
        setActiveQuizId(quiz.id);
        go("/");
      }),
    );

  const addTo = (quizId: number) => {
    const quiz = mine.find((q) => q.id === quizId);
    if (!quiz) return;
    appendActions(quizId, contentToActions(content));
    setAdded({ id: quiz.id, name: quiz.name });
  };

  return (
    <li className="jqzz-shelf-row" style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      {item.kind === "QUESTION" && first?.imageUrl && (
        <QuestionImage src={first.imageUrl} viewerId={me} className="jqzz-shelf-thumb" />
      )}
      <div className="jqzz-shelf-body">
        <span className="jqzz-shelf-title">{item.title || item.handle}</span>
        <span className="jqzz-annot">
          {item.kind === "QUIZ"
            ? plural(content.questions.length, "question")
            : `${typeLabel(first?.type)} · ${plural(first?.answers.length ?? 0, "answer")}`}
          {item.source && item.source !== item.title && ` · from ${item.source}`}
          {` · ${when(item.createdAt)}`}
        </span>
        {item.kind === "QUESTION" && first && first.answers.length > 0 && (
          <span className="jqzz-shelf-answers">
            {first.answers.slice(0, 6).map((a, i) => (
              <span key={i} className={a.value > 0 ? "good" : undefined}>
                {a.text || "·"}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="jqzz-shelf-id">
        {renaming ? (
          <RenameField
            handle={item.handle}
            onDone={(h) => {
              setRenaming(false);
              if (h && h !== item.handle) c.rename(h);
            }}
          />
        ) : (
          <RefChip reference={item.reference} me={me} />
        )}
        <VisibilitySwitch value={item.visibility} onChange={c.setVisibility} busy={c.busy} />
      </div>

      <div className="jqzz-shelf-actions">
        {item.kind === "QUIZ" && (
          <button className="jqzz-play-btn small primary" onClick={open} disabled={c.busy}>
            open as a new quiz
          </button>
        )}
        {item.kind === "QUESTION" &&
          (mine.length > 0 ? (
            <Select
              className="jqzz-shelf-pick"
              value=""
              placeholder="add to a quiz…"
              aria-label="Add this question to one of your quizzes"
              onChange={(v) => addTo(Number(v))}
              options={mine.map((q) => ({ value: String(q.id), label: q.name, icon: "QUIZ" }))}
            />
          ) : (
            <span className="jqzz-annot">make a quiz to add it to</span>
          ))}
        <button
          className="jqzz-play-btn small"
          disabled={c.busy}
          title="play it alone, straight away"
          onClick={() =>
            c.run(playService.practice(me, { stashId: item.id }).then((game) => go(`/play/${game.code}`)))
          }
        >
          practice
        </button>
        {item.kind === "QUESTION" && (
          <button
            className="jqzz-play-btn small ghost"
            disabled={c.busy}
            title="keep its type and steps, without the words, for new questions"
            onClick={() =>
              c.run(
                stashService
                  .asType(me, { itemId: item.id }, `${typeLabel(first?.type)}: ${item.title ?? "question"}`.slice(0, 60))
                  .then(put),
              )
            }
          >
            <Glyph name="TYPE" size={13} />
            save as type
          </button>
        )}
        {item.visibility !== "PRIVATE" && <ShareButton kind={item.kind} reference={item.reference} />}
        <button className="jqzz-play-btn small ghost" onClick={() => setRenaming(true)} disabled={c.busy}>
          rename
        </button>
        <ConfirmButton onConfirm={c.remove} disabled={c.busy}>
          remove
        </ConfirmButton>
      </div>

      {added && (
        <p className="jqzz-play-note jqzz-shelf-msg" role="status">
          added to the end of {added.name}.{" "}
          <button
            className="jqzz-linkish"
            onClick={() => {
              setActiveQuizId(added.id);
              go("/");
            }}
          >
            open it
          </button>
        </p>
      )}
      {c.error && (
        <p className="jqzz-play-note bad jqzz-shelf-msg" role="alert">
          {c.error}
        </p>
      )}
    </li>
  );
};

const RenameField: React.FC<{ handle: string; onDone: (h: string | null) => void }> = ({ handle, onDone }) => {
  const [value, setValue] = useState(handle);
  const valid = /^[a-zA-Z0-9_]+$/.test(value);
  return (
    <form
      className="jqzz-shelf-rename"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onDone(value);
      }}
    >
      <input
        className="jqzz-field-input"
        value={value}
        autoFocus
        spellCheck={false}
        aria-label="New name: letters, numbers and _"
        aria-invalid={!valid}
        onChange={(e) => setValue(e.target.value.replace(/\s+/g, "_"))}
        onKeyDown={(e) => e.key === "Escape" && onDone(null)}
        onBlur={() => onDone(valid ? value : null)}
      />
    </form>
  );
};

const ImagesTab: React.FC<{
  images: LibraryImage[];
  saved: StashItem[];
  me: string;
  put: (i: StashItem) => void;
  drop: (id: number) => void;
  putImage: (i: LibraryImage) => void;
}> = ({ images, saved, me, put, drop, putImage }) => (
  <>
    <h2 className="jqzz-shelf-head jqzz-annot">uploaded by you · {images.length}</h2>
    {images.length === 0 ? (
      <p className="jqzz-shelf-empty">no uploads yet. add pictures to questions in the editor.</p>
    ) : (
      <ul className="jqzz-shelf-grid">
        {images.map((img, i) => (
          <UploadCard key={img.id} img={img} me={me} index={i} putImage={putImage} />
        ))}
      </ul>
    )}
    <h2 className="jqzz-shelf-head jqzz-annot">saved from games · {saved.length}</h2>
    {saved.length === 0 ? (
      <p className="jqzz-shelf-empty">pictures come along when you save a quiz or question that uses them.</p>
    ) : (
      <ul className="jqzz-shelf-grid">
        {saved.map((item, i) => (
          <SavedImageCard key={item.id} item={item} me={me} index={i} put={put} drop={drop} />
        ))}
      </ul>
    )}
  </>
);

const UploadCard: React.FC<{ img: LibraryImage; me: string; index: number; putImage: (i: LibraryImage) => void }> = ({
  img,
  me,
  index,
  putImage,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="jqzz-shelf-card" style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      <img src={imageUrl(img.id, me)} alt="" loading="lazy" />
      <RefChip reference={img.reference} me={me} />
      <VisibilitySwitch
        value={img.visibility}
        busy={busy}
        onChange={(visibility) => {
          setBusy(true);
          setError(null);
          stashService
            .imageVisibility(me, img.id, visibility)
            .then(putImage)
            .catch((err) => setError(errorMessage(err)))
            .finally(() => setBusy(false));
        }}
      />
      {error && <p className="jqzz-play-note bad">{error}</p>}
    </li>
  );
};

const SavedImageCard: React.FC<{
  item: StashItem;
  me: string;
  index: number;
  put: (i: StashItem) => void;
  drop: (id: number) => void;
}> = ({ item, me, index, put, drop }) => {
  const c = useItemControls(item, me, put, drop);
  return (
    <li className="jqzz-shelf-card" style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      {item.imageId != null && <img src={imageUrl(item.imageId, me)} alt="" loading="lazy" />}
      <RefChip reference={item.reference} me={me} />
      {item.title && <RefChip reference={item.title} me={me} label="picture" />}
      <VisibilitySwitch value={item.visibility} onChange={c.setVisibility} busy={c.busy} />
      <ConfirmButton onConfirm={c.remove} disabled={c.busy}>
        remove
      </ConfirmButton>
      {c.error && <p className="jqzz-play-note bad">{c.error}</p>}
    </li>
  );
};

/** Copies a link that puts this item into whoever opens it. Only for shared and public items. */
const ShareButton: React.FC<{ kind: StashKind; reference: string }> = ({ kind, reference }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      className="jqzz-play-btn small ghost"
      title="copy a link that adds it to whoever opens it"
      onClick={() =>
        navigator.clipboard?.writeText(shareLink(kind, reference)).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        })
      }
    >
      {done ? "link copied" : "share link"}
    </button>
  );
};

const PHASES: Phase[] = ["WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"];
const WRITTEN = (t: string) => t.startsWith("USER_GENERATED") || t === "KNOCKOUT_BATTLE";

/**
 * Question types: what "add" offers in the editor. Everyone starts with the
 * defaults; edit them, add your own from any question, or go back.
 */
const TypesTab: React.FC<{
  types: StashItem[];
  me: string;
  put: (i: StashItem) => void;
  drop: (id: number) => void;
  reload: React.Dispatch<React.SetStateAction<StashList | null>>;
}> = ({ types, me, put, drop, reload }) => {
  const [resetting, setResetting] = useState(false);
  return (
    <>
      <div className="jqzz-shelf-bar">
        <p className="jqzz-annot">
          {plural(types.length, "type")} · these are what "add" offers in the editor
        </p>
        <button className="jqzz-play-btn small" onClick={() => setResetting(true)}>
          <Glyph name="RESET" size={13} />
          reset to default
        </button>
      </div>
      {types.length === 0 && (
        <p className="jqzz-shelf-empty">no types left. reset to default to get the built-in ones back.</p>
      )}
      <ul className="jqzz-type-grid">
        {types.map((t, i) => (
          <TypeCard key={`${t.id}:${t.payload}`} item={t} me={me} index={i} put={put} drop={drop} />
        ))}
      </ul>
      {resetting && (
        <ResetDialog
          me={me}
          onClose={() => setResetting(false)}
          onDone={(fresh) => {
            reload((d) => d && { ...d, items: [...d.items.filter((x) => x.kind !== "TYPE"), ...fresh] });
            setResetting(false);
          }}
        />
      )}
    </>
  );
};

/** One type, edited in place: name, question type, answer slots, steps. */
const TypeCard: React.FC<{
  item: StashItem;
  me: string;
  index: number;
  put: (i: StashItem) => void;
  drop: (id: number) => void;
}> = ({ item, me, index, put, drop }) => {
  const c = useItemControls(item, me, put, drop);
  const saved = useMemo(() => readType(item), [item]);
  // a fresh card is mounted when the saved shape changes (see its key), so the draft starts from it
  const [draft, setDraft] = useState<TypeShape>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const total = draft.steps.reduce((sum, s) => sum + (s.time || 0), 0);
  const written = WRITTEN(draft.questionType);
  const set = (patch: Partial<TypeShape>) => setDraft((d) => ({ ...d, ...patch }));
  const setStep = (i: number, patch: Partial<TypeShape["steps"][number]>) =>
    set({ steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const slots = (n: number) =>
    set({
      answers: Array.from({ length: n }, (_, i) => draft.answers[i] ?? { text: "", value: i === 0 ? 100 : 0 }),
    });

  return (
    <li className="jqzz-type-card" style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      <div className="jqzz-type-head">
        <span className="jqzz-type-tile" aria-hidden="true">
          <Glyph name={draft.questionType} size={18} />
        </span>
        <input
          className="jqzz-type-name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          aria-label="Type name"
        />
        <ConfirmButton onConfirm={c.remove} disabled={c.busy}>
          remove
        </ConfirmButton>
      </div>
      <div className="jqzz-type-fields">
        <label className="jqzz-annot">
          question
          <Select
            value={draft.questionType}
            aria-label="Question type"
            onChange={(v) => set({ questionType: v })}
            options={Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => ({ value, label, icon: value }))}
          />
        </label>
        {!written && (
          <label className="jqzz-annot">
            answers
            <input
              className="jqzz-field-input"
              type="number"
              min={0}
              max={12}
              value={draft.answers.length}
              onChange={(e) => slots(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            />
          </label>
        )}
      </div>
      <ol className="jqzz-type-steps">
        {draft.steps.map((s, i) => (
          <li key={i} style={{ "--node": `var(--phase-${s.phase})` } as React.CSSProperties}>
            <Glyph name={s.phase} size={13} />
            <Select
              value={s.phase}
              onChange={(v) => setStep(i, { phase: v as Phase })}
              aria-label={`Step ${i + 1}`}
              options={PHASES.map((p) => ({ value: p, label: p.toLowerCase(), icon: p }))}
            />
            <input
              className="jqzz-field-input"
              type="number"
              min={1}
              value={s.time}
              onChange={(e) => setStep(i, { time: Math.max(1, Number(e.target.value) || 1) })}
              aria-label={`Seconds for step ${i + 1}`}
            />
            <span className="jqzz-annot">s</span>
            <button
              className="jqzz-icon-btn"
              onClick={() => set({ steps: draft.steps.filter((_, j) => j !== i) })}
              disabled={draft.steps.length <= 1}
              aria-label={`Remove step ${i + 1}`}
            >
              <Glyph name="CLOSE" size={12} />
            </button>
          </li>
        ))}
      </ol>
      <span className="jqzz-phase-strip" aria-hidden="true">
        {draft.steps.map((s, j) => (
          <span key={j} style={{ flexGrow: Math.max(s.time, 1), background: `var(--phase-${s.phase})` }} />
        ))}
      </span>
      <div className="jqzz-type-foot">
        <button
          className="jqzz-play-btn small ghost"
          onClick={() => set({ steps: [...draft.steps, { phase: "RESULT", time: 10, preview: "" }] })}
        >
          <Glyph name="ADD" size={12} />
          step
        </button>
        <span className="jqzz-annot">{total}s</span>
        <span className="jqzz-type-save">
          {dirty && (
            <button className="jqzz-play-btn small ghost" onClick={() => setDraft(saved)} disabled={c.busy}>
              undo
            </button>
          )}
          <button
            className="jqzz-play-btn small primary"
            disabled={!dirty || c.busy || !draft.name.trim()}
            onClick={() =>
              c.run(
                stashService
                  .update(me, item.id, { title: draft.name.trim(), payload: JSON.stringify(draft) })
                  .then(put),
              )
            }
          >
            {c.busy ? "saving…" : "save"}
          </button>
        </span>
      </div>
      <div className="jqzz-type-share">
        <RefChip reference={item.reference} me={me} />
        <VisibilitySwitch value={item.visibility} onChange={c.setVisibility} busy={c.busy} />
      </div>
      {c.error && <p className="jqzz-play-note bad">{c.error}</p>}
    </li>
  );
};

/** Before the types go back to the defaults: what that means, and the three ways out. */
const ResetDialog: React.FC<{ me: string; onClose: () => void; onDone: (types: StashItem[]) => void }> = ({
  me,
  onClose,
  onDone,
}) => {
  const [busy, setBusy] = useState<"full" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = (mode: "full" | "add") => {
    setBusy(mode);
    setError(null);
    stashService
      .resetTypes(me, mode)
      .then(onDone)
      .catch((err) => {
        setError(errorMessage(err));
        setBusy(null);
      });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="jqzz-modal-overlay" data-state="open" onClick={onClose}>
      <div
        className="jqzz-modal jqzz-holo jqzz-reset"
        data-state="open"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="jqzz-reset-title"
        aria-describedby="jqzz-reset-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="jqzz-reset-title" className="jqzz-chroma">reset types</h3>
        <p id="jqzz-reset-text" className="jqzz-reset-text">
          <b>full reset</b> throws away every type in your stash, the ones you made and the ones you edited,
          and puts the built-in ones back as they came. This can't be undone.
          <br />
          <br />
          <b>add the defaults</b> only puts back the built-in ones you're missing. Nothing is removed.
        </p>
        {error && <p className="jqzz-modal-error">{error}</p>}
        <div className="jqzz-reset-choices">
          <button className="jqzz-play-btn danger" onClick={() => go("full")} disabled={busy !== null}>
            <Glyph name="RESET" size={14} />
            {busy === "full" ? "resetting…" : "full reset"}
          </button>
          <button className="jqzz-play-btn primary" onClick={() => go("add")} disabled={busy !== null} autoFocus>
            <Glyph name="ADD" size={14} />
            {busy === "add" ? "adding…" : "add the defaults"}
          </button>
          <button className="jqzz-play-btn ghost" onClick={onClose} disabled={busy !== null}>
            <Glyph name="CLOSE" size={14} />
            cancel
          </button>
        </div>
      </div>
    </div>
  );
};
