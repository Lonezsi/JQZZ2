import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuiz } from "../../contexts/QuizContext";
import { go } from "../../hooks/useHashRoute";
import { errorMessage } from "../../services/api";
import { imageUrl, stashService } from "../../services/stashService";
import type { ImageVisibility } from "../../types";
import type { LibraryImage, StashItem, StashKind, StashList } from "../../types/stash";
import { typeLabel } from "../../utils/questionInfo";
import { contentToActions, readContent } from "../../utils/stashContent";
import { PlayFrame, QuestionImage } from "../Play/PlayCommon";
import { ConfirmButton, RefChip, VisibilitySwitch } from "./StashBits";
import { plural, when } from "../../utils/format";

type Tab = "quizzes" | "questions" | "images";
const TABS: { tab: Tab; kind: StashKind; label: string }[] = [
  { tab: "quizzes", kind: "QUIZ", label: "quizzes" },
  { tab: "questions", kind: "QUESTION", label: "questions" },
  { tab: "images", kind: "IMAGE", label: "images" },
];

/**
 * Everything you saved: whole quizzes, single questions, pictures. Each has an
 * id like the image library's: ":name" for you, "yourid:name" for others when
 * shared, just "name" once public.
 */
export const StashPage: React.FC<{ tab?: string }> = ({ tab: fromRoute }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const tab = TABS.find((t) => t.tab === fromRoute) ?? TABS[0];
  const [data, setData] = useState<StashList | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const items = useMemo(() => data?.items.filter((i) => i.kind === tab.kind) ?? [], [data, tab.kind]);
  const counts = useMemo(() => {
    const c: Record<StashKind, number> = { QUIZ: 0, QUESTION: 0, IMAGE: data?.images.length ?? 0 };
    data?.items.forEach((i) => c[i.kind]++);
    return c;
  }, [data]);

  return (
    <PlayFrame>
      <header className="jqzz-play-bar compact">
        <button className="jqzz-play-btn ghost" onClick={() => go("/")} title="back to the editor">
          ←
        </button>
        <span className="jqzz-play-title">stash</span>
        <a className="jqzz-play-btn ghost" href="#/history">
          history
        </a>
      </header>

      <main className="jqzz-shelf">
        <nav className="jqzz-shelf-tabs" aria-label="What you saved">
          {TABS.map((t) => (
            <a
              key={t.tab}
              href={`#/stash/${t.tab}`}
              className="jqzz-shelf-tab"
              aria-current={t.tab === tab.tab ? "page" : undefined}
            >
              {t.label}
              <span className="jqzz-annot">{counts[t.kind]}</span>
            </a>
          ))}
        </nav>

        <AddByRef kind={tab.kind} me={me} onAdded={put} />

        {error && <p className="jqzz-play-note bad">{error}</p>}
        {!data && !error && <p className="jqzz-annot jqzz-shelf-empty">loading…</p>}

        {data && tab.kind === "IMAGE" && (
          <ImagesTab images={data.images} saved={items} me={me} put={put} drop={drop} putImage={putImage} />
        )}
        {data && tab.kind !== "IMAGE" && (
          <>
            {items.length === 0 && (
              <p className="jqzz-shelf-empty">
                nothing here yet. finish a game and save {tab.kind === "QUIZ" ? "the quiz" : "a question"} from
                the final screen, or from <a href="#/history">your history</a>.
              </p>
            )}
            <ul className="jqzz-shelf-list">
              {items.map((item, i) => (
                <StashRow key={item.id} item={item} me={me} index={i} put={put} drop={drop} />
              ))}
            </ul>
          </>
        )}
      </main>
    </PlayFrame>
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
            <select
              className="jqzz-field-select jqzz-shelf-pick"
              value=""
              aria-label="Add this question to one of your quizzes"
              onChange={(e) => addTo(Number(e.target.value))}
            >
              <option value="" disabled>
                add to a quiz…
              </option>
              {mine.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="jqzz-annot">make a quiz to add it to</span>
          ))}
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
