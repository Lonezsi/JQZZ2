import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { ImageUploadModal } from "./ImageUploadModal";

interface ImagePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
}) => {
  const { user } = useAuth();
  const [showGallery, setShowGallery] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setImageUrl(null);
      return;
    }
    if (value.startsWith("http") || value.startsWith("data:")) {
      setImageUrl(value);
      return;
    }
    const resolve = async () => {
      setLoading(true);
      try {
        const response = await api.get("/images/resolve", {
          params: { ref: value },
          headers: { "X-User-Id": user?.id || "" },
        });
        const { id } = response.data;
        setImageUrl(`${api.defaults.baseURL}/images/${id}?userId=${user?.id}`);
      } catch (err) {
        console.error("Failed to resolve image", err);
        setImageUrl(null);
      } finally {
        setLoading(false);
      }
    };
    resolve();
  }, [value, user?.id]);

  const handleUploadSave = (reference: string) => {
    onChange(reference);
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <div style={{ width: "40px", height: "40px" }}>
        {loading && <div>...</div>}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "4px",
              objectFit: "cover",
            }}
          />
        )}
        {!imageUrl && !loading && value && (
          <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>?</div>
        )}
        {!value && (
          <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>none</div>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          className="jqzz-modal-btn"
          onClick={() => setShowGallery(true)}
        >
          Select
        </button>
        <button
          type="button"
          className="jqzz-modal-btn"
          onClick={() => setShowUpload(true)}
        >
          Upload
        </button>
      </div>

      {showGallery && (
        <ImageGalleryModal
          onClose={() => setShowGallery(false)}
          onSelect={onChange}
        />
      )}
      {showUpload && user && (
        <ImageUploadModal
          onClose={() => setShowUpload(false)}
          onSave={handleUploadSave}
          userId={user.id}
        />
      )}
    </div>
  );
};
