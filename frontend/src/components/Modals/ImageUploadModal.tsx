import React, { useState, useRef } from "react";

interface ImageUploadModalProps {
  onClose: () => void;
  onSave: (imageUrl: string) => void;
  currentImageUrl?: string;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  onClose,
  onSave,
  currentImageUrl = "",
}) => {
  const [imageUrl, setImageUrl] = useState(currentImageUrl);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const [activeTab, setActiveTab] = useState<"url" | "upload">("url");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url);
    setPreviewUrl(url);
  };

  const handleSave = () => {
    if (imageUrl && imageUrl.trim()) {
      onSave(imageUrl.trim());
    }
    onClose();
  };

  const handleRemove = () => {
    setImageUrl("");
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="jqzz-modal-overlay img-upload" onClick={onClose}>
      <div
        className="jqzz-modal img-upload"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "400px" }}
      >
        <h3>Profile Picture</h3>

        {/* Preview section */}
        {previewUrl && (
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid var(--accent)`,
              }}
            />

            <button
              className="jqzz-modal-btn"
              onClick={handleRemove}
              style={{
                width: "100%",
              }}
            >
              Remove
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="jqzz-rpanel-tabs" style={{ marginBottom: "16px" }}>
          <button
            className={`jqzz-rpanel-tab${activeTab === "url" ? " active" : ""}`}
            onClick={() => setActiveTab("url")}
          >
            URL
          </button>
          <button
            className={`jqzz-rpanel-tab${activeTab === "upload" ? " active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload
          </button>
        </div>

        {/* URL input tab */}
        {activeTab === "url" && (
          <div>
            <div className="jqzz-field-label">Image URL</div>
            <input
              className="jqzz-modal-input"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={handleUrlChange}
            />
          </div>
        )}

        {/* File upload tab */}
        {activeTab === "upload" && (
          <div>
            <div className="jqzz-field-label">Upload Image</div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              ref={fileInputRef}
              style={{
                width: "100%",
                padding: "8px",
                background: "var(--bg-highlight)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-dim)",
                marginTop: "8px",
              }}
            >
              Supports JPG, PNG, GIF. Max size 5MB.
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="jqzz-modal-row" style={{ marginTop: "20px" }}>
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="jqzz-modal-btn primary"
            onClick={handleSave}
            disabled={!imageUrl?.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
