import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DrawingFrame, type DrawingFrameHandle } from "../../draw/DrawingFrame";
import { useEscape } from "../../hooks/useEscape";
import { errorMessage } from "../../services/api";
import { stashService } from "../../services/stashService";
import type { StashItem, StashKind } from "../../types/stash";
import { ImageUploadModal } from "../Modals/ImageUploadModal";
import { Glyph } from "../common/Glyph";
import { Popover } from "../common/Popover";

/** what a share link names, by the word in it (#/stash/add/<kind>/<ref>) */
const LINK_KINDS: Record<string, StashKind> = {
  quiz: "QUIZ",
  question: "QUESTION",
  image: "IMAGE",
  type: "TYPE",
  drawing: "DRAWING",
};

/**
 * The stash's +: a new picture, four ways. Upload one from this device, copy
 * one in from a link someone shared (or its "handle:name"), take one from a
 * web address, or draw one, with all the time in the world.
 */
export const AddPicture: React.FC<{
  me: string;
  /** something new is in the stash: look again */
  onAdded: (item?: StashItem) => void;
  onDraw: () => void;
}> = ({ me, onAdded, onDraw }) => {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<"link" | "url" | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);

  const close = () => {
    setOpen(false);
    setAsking(null);
    setValue("");
    setNote(null);
  };

  const go = () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setNote(null);
    const done = asking === "url" ? stashService.fromUrl(me, v).then(() => undefined) : fromLink(me, v);
    done
      .then((item) => {
        onAdded(item ?? undefined);
        setNote({ text: item ? `${item.title || item.handle} is in your stash now` : "it's in your images now" });
        setValue("");
      })
      .catch((err) => setNote({ text: errorMessage(err), bad: true }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="jqzz-pic-add">
      <button
        type="button"
        className="jqzz-pic-add-btn"
        aria-label="Add a picture"
        aria-expanded={open}
        title="add a picture"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Glyph name="ADD" size={16} />
      </button>
      <Popover open={open} onClose={close} label="Add a picture" className="jqzz-holo jqzz-pic-add-menu">
        {asking ? (
          <form
            className="jqzz-pic-add-ask"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label className="jqzz-annot" htmlFor="jqzz-add-value">
              {asking === "url" ? "the picture's web address" : "the link someone shared, or its handle:name"}
            </label>
            <input
              id="jqzz-add-value"
              className="jqzz-field-input"
              autoFocus
              value={value}
              inputMode="url"
              placeholder={asking === "url" ? "https://..." : "bori:sunset"}
              onChange={(e) => setValue(e.target.value)}
            />
            <div className="jqzz-play-row">
              <button type="button" className="jqzz-play-btn small ghost" onClick={() => setAsking(null)}>
                back
              </button>
              <button type="submit" className="jqzz-play-btn small primary" disabled={busy || !value.trim()}>
                {busy ? "getting it..." : "add it"}
              </button>
            </div>
            {note && <p className={`jqzz-play-note${note.bad ? " bad" : ""}`}>{note.text}</p>}
          </form>
        ) : (
          <ul className="jqzz-pic-add-ways">
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  setUploading(true);
                }}
              >
                <Glyph name="IMAGE" size={14} /> upload one
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setAsking("link")}>
                <Glyph name="BROWSE" size={14} /> from a shared link
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setAsking("url")}>
                <Glyph name="PUBLIC" size={14} /> from a web address
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onDraw();
                }}
              >
                <Glyph name="DRAW" size={14} /> draw one
              </button>
            </li>
          </ul>
        )}
      </Popover>
      {uploading && (
        <ImageUploadModal userId={me} onClose={() => setUploading(false)} onSave={() => onAdded()} />
      )}
    </div>
  );
};

/** a share link (…#/stash/add/image/bori:sunset) or a bare reference, copied in */
function fromLink(me: string, text: string): Promise<StashItem> {
  const m = text.match(/#\/stash\/add\/([a-z]+)\/(.+)$/);
  if (m) {
    const kind = LINK_KINDS[m[1]];
    if (!kind) return Promise.reject(new Error("That link isn't to anything a stash can hold"));
    return stashService.fromRef(me, kind, decodeURIComponent(m[2]));
  }
  // a bare reference: a picture first, then a drawing
  return stashService.fromRef(me, "IMAGE", text).catch(() => stashService.fromRef(me, "DRAWING", text));
}

/**
 * Drawing in the stash: the whole drawing frame over the page, with no clock.
 * Saved, it's a drawing (its layers kept, StashKind DRAWING), and saving
 * again changes the same one. A drawing in progress outlives a reload.
 */
export const DrawStudio: React.FC<{
  me: string;
  /** a drawing to go on with, or none for a new one */
  item: StashItem | null;
  onSaved: (item: StashItem) => void;
  onClose: () => void;
}> = ({ me, item, onSaved, onClose }) => {
  const frame = useRef<DrawingFrameHandle>(null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [savedId, setSavedId] = useState<number | null>(item?.id ?? null);
  const keepAs = `jqzz:studio:${item?.id ?? "new"}`;

  // closing with something unsaved asks first, in the page (a browser's own
  // confirm box can be turned off, and then nothing would close)
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const forget = () => {
    try {
      sessionStorage.removeItem(keepAs);
    } catch {
      /* nothing kept */
    }
  };
  const leave = () => {
    if (frame.current?.unsent) {
      setProblem(null);
      setAsking(true);
      return;
    }
    forget();
    onClose();
  };
  const save = async () => {
    const f = frame.current;
    if (!f) return false;
    const saved = await stashService.saveDrawing(me, {
      id: savedId ?? undefined,
      title: title.trim() || undefined,
      layers: f.snapshot(),
      picture: await f.export(),
    });
    setSavedId(saved.id);
    onSaved(saved);
    return true;
  };
  const saveAndClose = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await save();
      forget();
      onClose();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  // Esc: the question first (keep drawing), then the studio itself
  useEscape(true, leave);
  useEscape(asking, () => setAsking(false));

  const download = async (kind: "png" | "ora") => {
    const f = frame.current;
    if (!f) return;
    try {
      const blob = kind === "png" ? await f.png() : await f.ora();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(title.trim() || "drawing").replace(/[\\/:*?"<>|]+/g, "_")}.${kind}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't export it");
    }
  };

  return createPortal(
    <div className="jqzz-studio" role="dialog" aria-label={item ? "Draw on it" : "Draw a picture"}>
      <div className="jqzz-studio-head">
        <input
          className="jqzz-field-input jqzz-studio-title"
          value={title}
          placeholder="what is it?"
          aria-label="Name"
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="button" className="jqzz-play-btn small ghost" onClick={() => download("png")} title="the picture, full size">
          export .png
        </button>
        <button
          type="button"
          className="jqzz-play-btn small ghost"
          onClick={() => download("ora")}
          title="every layer, for Krita, GIMP or MyPaint"
        >
          export layers .ora
        </button>
        <button type="button" className="jqzz-play-btn small ghost" onClick={leave}>
          close
        </button>
      </div>
      <DrawingFrame
        ref={frame}
        keepAs={keepAs}
        start={item?.payload ?? null}
        sendLabel="save to your stash"
        verb="save"
        onSend={async (picture) => {
          const layers = frame.current?.snapshot();
          if (!layers) return false;
          const saved = await stashService.saveDrawing(me, {
            id: savedId ?? undefined,
            title: title.trim() || undefined,
            layers,
            picture,
          });
          setSavedId(saved.id);
          onSaved(saved);
          return true;
        }}
      />
      {asking && (
        <div className="jqzz-modal-overlay" onClick={() => setAsking(false)}>
          <div
            className="jqzz-modal jqzz-holo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="jqzz-studio-leave"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="jqzz-modal-head">
              <h3 id="jqzz-studio-leave" className="jqzz-chroma">
                it isn't saved
              </h3>
            </div>
            <p className="jqzz-play-note">
              {savedId == null ? "this drawing isn't in your stash yet." : "what you've drawn since the last save isn't in your stash."}
            </p>
            {problem && <p className="jqzz-play-note bad">{problem}</p>}
            <div className="jqzz-modal-row jqzz-studio-leave-row">
              <button type="button" className="jqzz-modal-btn primary" disabled={saving} onClick={saveAndClose} autoFocus>
                {saving ? "saving..." : "save and close"}
              </button>
              <button
                type="button"
                className="jqzz-modal-btn danger"
                disabled={saving}
                onClick={() => {
                  forget();
                  onClose();
                }}
              >
                close without saving
              </button>
              <button type="button" className="jqzz-modal-btn ghost" disabled={saving} onClick={() => setAsking(false)}>
                keep drawing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
