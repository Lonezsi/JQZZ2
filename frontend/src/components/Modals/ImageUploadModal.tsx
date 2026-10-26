import { useState } from "react";
import { createPortal } from "react-dom";
import { api, errorMessage } from "../../services/api";
import type { ImageVisibility } from "../../types";

interface ImageUploadModalProps {
  onClose: () => void;
  onSave: (reference: string) => void;
  userId: string;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  onClose,
  onSave,
  userId,
}) => {
  const [handle, setHandle] = useState("");
  const [visibility, setVisibility] = useState<ImageVisibility>("PRIVATE");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      if (!handle) {
        setHandle(f.name.replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9_]/g, ""));
      }
    }
  };

  const handleSave = async () => {
    if (!file || !handle.trim()) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("handle", handle.trim());
    formData.append("ownerId", userId);
    formData.append("visibility", visibility);
    formData.append("file", file);
    try {
      const response = await api.post("/images/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-User-Id": userId,
        },
      });
      const data = response.data;
      const ref = visibility === "PUBLIC" ? data.handle : `:${data.handle}`;
      onSave(ref);
      onClose();
    } catch (err) {
      setError(`upload failed: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // portaled: a backdrop-filter ancestor (the right panel) would otherwise
  // become the containing block of this fixed overlay and clip it
  return createPortal(
    <div className="jqzz-modal-overlay img-upload" onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      <div
        className="jqzz-modal img-upload jqzz-holo sheen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jqzz-upload-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jqzz-holo-dust" aria-hidden="true" />
        <div className="jqzz-modal-head">
          <h3 id="jqzz-upload-title" className="jqzz-chroma">upload a picture</h3>
          <span className="jqzz-annot">max 10 mb</span>
        </div>

        <label className="jqzz-file-drop">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview of the picked file" />
          ) : (
            <span>pick an image</span>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>

        <label className="jqzz-field-label" htmlFor="jqzz-img-handle">
          name <span className="jqzz-optional">letters, numbers, _</span>
        </label>
        <input
          id="jqzz-img-handle"
          className="jqzz-modal-input"
          placeholder="mycat"
          value={handle}
          onChange={(e) =>
            setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
        />
        <label className="jqzz-field-label" htmlFor="jqzz-img-vis">
          who can use it
        </label>
        <select
          id="jqzz-img-vis"
          className="jqzz-field-select jqzz-modal-input"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ImageVisibility)}
        >
          <option value="PRIVATE">only me</option>
          <option value="SEMI_PRIVATE">others too, it stays mine</option>
          <option value="PUBLIC">everyone, public name</option>
        </select>

        {error && (
          <p className="jqzz-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="jqzz-modal-row">
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="jqzz-modal-btn primary"
            onClick={handleSave}
            disabled={loading || !file || !handle.trim()}
          >
            {loading ? "uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
