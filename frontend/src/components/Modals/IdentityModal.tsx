import React, { useState } from "react";
import type { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";

interface IdentityModalProps {
  current: User | null;
  onSave: (user: User) => void; // always expects a User
  onClose: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  current,
  onSave,
  onClose,
}) => {
  const { updateUser, register } = useAuth();
  const [name, setName] = useState(current?.name ?? "");
  const [handle, setHandle] = useState(current?.handle ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (!current) {
        // New user: register with the given name
        const user = await register(name.trim());
        if (user) {
          onSave(user); // pass the new user
        }
      } else {
        // Existing user: update name and/or handle
        if (name !== current.name) {
          await userService.updateName(current.id, { name });
        }
        if (handle !== current.handle && handle.trim()) {
          await userService.updateHandle(current.id, { handle: handle.trim() });
        }
        const updated = { ...current, name, handle };
        updateUser(updated);
        onSave(updated);
      }
    } catch (error) {
      alert(
        "Failed to update identity" +
          (error instanceof Error ? `: ${error.message}` : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jqzz-modal-overlay" onClick={onClose}>
      <div className="jqzz-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{current ? "# Set Identity" : "# Create Account"}</h3>
        <div className="jqzz-field-label" style={{ marginBottom: 5 }}>
          Display Name
        </div>
        <input
          className="jqzz-modal-input"
          placeholder="e.g. lonezsi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {current && (
          <>
            <div className="jqzz-field-label" style={{ marginBottom: 5 }}>
              Handle
            </div>
            <input
              className="jqzz-modal-input"
              placeholder="@handle"
              value={handle}
              onChange={(e) =>
                setHandle(
                  e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""),
                )
              }
            />
          </>
        )}
        <div className="jqzz-modal-row">
          <button
            className="jqzz-modal-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="jqzz-modal-btn primary"
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            {loading ? "Saving..." : current ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};
