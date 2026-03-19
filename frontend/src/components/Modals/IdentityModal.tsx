import React, { useState } from "react";
import type { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";

interface IdentityModalProps {
  current: User;
  onSave: (id: User) => void;
  onClose: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  current,
  onSave,
  onClose,
}) => {
  const { updateUser } = useAuth();
  const [name, setName] = useState(current.name);
  const [handle, setHandle] = useState(current.handle);

  const handleSave = async () => {
    try {
      if (name !== current.name) {
        await userService.updateName(current.id, { name });
      }
      if (handle !== current.handle) {
        await userService.updateHandle(current.id, { handle });
      }
      const updated = { ...current, name, handle };
      updateUser(updated);
      onSave(updated);
    } catch (error) {
      alert(
        "Failed to update identity" +
          (error instanceof Error ? `: ${error.message}` : ""),
      );
    }
  };

  return (
    <div className="jqzz-modal-overlay" onClick={onClose}>
      <div className="jqzz-modal" onClick={(e) => e.stopPropagation()}>
        <h3># Set Identity</h3>
        <div className="jqzz-field-label" style={{ marginBottom: 5 }}>
          Display Name
        </div>
        <input
          className="jqzz-modal-input"
          placeholder="e.g. lonezsi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="jqzz-field-label" style={{ marginBottom: 5 }}>
          Handle
        </div>
        <input
          className="jqzz-modal-input"
          placeholder="@handle"
          value={handle}
          onChange={(e) =>
            setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
          }
        />
        <div className="jqzz-modal-row">
          <button className="jqzz-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="jqzz-modal-btn primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
