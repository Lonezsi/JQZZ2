import { useState } from "react";
import { api } from "../../services/api";
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const handleSave = async () => {
    if (!file || !handle.trim()) return;
    setLoading(true);
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
      const msg = (err as Error).message;
      alert(`Upload failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jqzz-modal-overlay img-upload" onClick={onClose}>
      <div
        className="jqzz-modal img-upload"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Upload Image</h3>
        <div className="jqzz-field-label">Handle</div>
        <input
          className="jqzz-modal-input"
          placeholder="mycat (optional)"
          value={handle}
          onChange={(e) =>
            setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
        />
        <div className="jqzz-field-label">Visibility</div>
        <select
          className="jqzz-field-select"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ImageVisibility)}
        >
          <option value="PUBLIC">Public (global)</option>
          <option value="PRIVATE">Private (only me)</option>
          <option value="SEMI_PRIVATE">Semi‑private (others can use)</option>
        </select>
        <div className="jqzz-field-label">Image File</div>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            style={{ maxWidth: "100%", marginTop: 8 }}
          />
        )}
        <div className="jqzz-modal-row">
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="jqzz-modal-btn primary"
            onClick={handleSave}
            disabled={loading || !file}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};
