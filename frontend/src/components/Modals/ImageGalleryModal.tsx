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

  const filtered = images.filter((img) => {
    const ref =
      img.ownerId === user?.id
        ? `:${img.handle}`
        : `${img.ownerId}:${img.handle}`;
    return ref.toLowerCase().includes(search.toLowerCase());
  });

  return createPortal(
    <div className="jqzz-modal-overlay" onClick={onClose}>
      <div
        className="jqzz-modal"
        style={{ width: "600px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Select Image</h3>
        <input
          type="text"
          placeholder="Search by reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="jqzz-modal-input"
        />
        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {loading && <div>Loading...</div>}
          {filtered.map((img) => {
            const ref =
              img.ownerId === user?.id
                ? `:${img.handle}`
                : `${img.ownerId}:${img.handle}`;
            const url = imageUrls.get(img.id);
            return (
              <div
                key={img.id}
                onClick={() => onSelect(ref)}
                className="jqzz-image-gallery-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--bg-highlight)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {url ? (
                  <img
                    src={url}
                    alt={ref}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "4px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      background: "var(--bg-elevated)",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                    }}
                  >
                    ?
                  </div>
                )}
                <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                  {ref}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              No images found.
            </div>
          )}
        </div>
        <div className="jqzz-modal-row" style={{ marginTop: "16px" }}>
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
