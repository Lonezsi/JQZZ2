import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

interface Image {
  id: number;
  handle: string;
  ownerId: string | null;
  visibility: string;
}

interface ImageGalleryModalProps {
  onClose: () => void;
  onSelect: (reference: string) => void;
}

export const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  onClose,
  onSelect,
}) => {
  const { user } = useAuth();
  const [images, setImages] = useState<Image[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await api.get("/images", {
          headers: { "X-User-Id": user?.id || "" },
        });
        const data = response.data;
        setImages(data);
        const newMap = new Map();
        for (const img of data) {
          const url = `${api.defaults.baseURL}/images/${img.id}?userId=${user?.id}`;
          newMap.set(img.id, url);
        }
        setImageUrls(newMap);
      } catch (err) {
        console.error("Failed to fetch images", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchImages();
  }, [user]);

  const toRef = (img: Image): string => {
    if (img.ownerId == null) return img.handle; // public
    if (img.ownerId === user?.id) return `:${img.handle}`; // self
    return `${img.ownerId}:${img.handle}`; // other user
  };

  const filtered = images.filter((img) => {
    const ref = toRef(img);
    return ref.toLowerCase().includes(search.toLowerCase());
  });

  const visibilityLabel: Record<string, string> = {
    PUBLIC: "public",
    PRIVATE: "only you",
    SEMI_PRIVATE: "shared",
  };

  return createPortal(
    <div className="jqzz-modal-overlay" onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      <div
        className="jqzz-modal wide jqzz-holo sheen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jqzz-gallery-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jqzz-holo-dots" aria-hidden="true" />
        <div className="jqzz-modal-head">
          <h3 id="jqzz-gallery-title" className="jqzz-chroma">pick a picture</h3>
          <span className="jqzz-annot">{images.length} available</span>
        </div>
        <input
          type="search"
          placeholder="search by name"
          aria-label="Search pictures"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="jqzz-modal-input"
        />
        <div className="jqzz-gallery-grid">
          {loading && <p className="jqzz-panel-hint">loading…</p>}
          {filtered.map((img) => {
            const ref = toRef(img);
            const url = imageUrls.get(img.id);
            return (
              <button
                key={img.id}
                onClick={() => onSelect(ref)}
                className="jqzz-image-gallery-item"
                style={{ "--i": filtered.indexOf(img) } as React.CSSProperties}
              >
                <span className="jqzz-gallery-thumb">
                  {url ? <img src={url} alt="" /> : <span aria-hidden="true">?</span>}
                </span>
                <span className="jqzz-gallery-ref">{ref}</span>
                <span className="jqzz-annot">{visibilityLabel[img.visibility] ?? img.visibility}</span>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && !loading && (
          <p className="jqzz-panel-hint">
            {images.length === 0 ? "no pictures yet. upload one first." : "nothing matches that."}
          </p>
        )}
        <div className="jqzz-modal-row">
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
