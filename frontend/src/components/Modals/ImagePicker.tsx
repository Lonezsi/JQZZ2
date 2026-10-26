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
    <div className="jqzz-picker">
      <div className="jqzz-picker-thumb" title={value || undefined}>
        {loading && <span className="jqzz-annot">…</span>}
        {imageUrl && <img src={imageUrl} alt="Preview" />}
        {!imageUrl && !loading && value && (
          <span className="jqzz-annot" title="can't find this image">?</span>
        )}
        {!value && <span className="jqzz-annot">none</span>}
      </div>
      <button
        type="button"
        className="jqzz-modal-btn"
        onClick={() => setShowGallery(true)}
      >
        Pick
      </button>
      <button
        type="button"
        className="jqzz-modal-btn"
        onClick={() => setShowUpload(true)}
      >
        Upload
      </button>

      {showGallery && (
        <ImageGalleryModal
          onClose={() => setShowGallery(false)}
          onSelect={(reference) => {
            onChange(reference);
            setShowGallery(false);
          }}
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
