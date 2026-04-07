import React, { useState } from "react";
import type { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";
import { ImagePicker } from "./ImagePicker";

interface IdentityModalProps {
  current: User | null;
  onSave: (user: User) => void;
  onClose: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  current,
  onSave,
  onClose,
}) => {
  const { updateUser, register, login, logout } = useAuth();
  const [name, setName] = useState(current?.name ?? "");
  const [handle, setHandle] = useState(current?.handle ?? "");
  const [email, setEmail] = useState(current?.email ?? "");
  const [profilePictureUrl, setProfilePictureUrl] = useState(
    current?.profilePictureUrl ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginId, setLoginId] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (!current) {
        const user = await register(name.trim());
        if (user) onSave(user);
      } else {
        const updates: Partial<User> = {};
        if (name !== current.name) updates.name = name;
        if (handle !== current.handle && handle.trim())
          updates.handle = handle.trim();
        if (email !== current.email) updates.email = email;
        if (profilePictureUrl !== current.profilePictureUrl)
          updates.profilePictureUrl = profilePictureUrl;

        if (Object.keys(updates).length > 0) {
          await userService.update(current.id, updates);
        }
        const updated = { ...current, ...updates };
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

  const handleLogin = async () => {
    if (!loginId.trim()) return;
    setLoading(true);
    try {
      const user = await login(loginId.trim());
      onSave(user);
    } catch (error) {
      alert(
        "Login failed" + (error instanceof Error ? `: ${error.message}` : ""),
      );
    } finally {
      setLoading(false);
      setShowLogin(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      const newUser = await register("Guest");
      onSave(newUser);
    } catch (error) {
      alert(
        "Logout failed" + (error instanceof Error ? `: ${error.message}` : ""),
      );
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleDeleteAccount = async () => {
    if (!current) return;
    if (
      !confirm(
        "Are you sure you want to delete your account? This cannot be undone.",
      )
    )
      return;
    setLoading(true);
    try {
      await userService.delete(current.id);
      const newUser = await register("Guest");
      onSave(newUser);
    } catch (error) {
      alert(
        "Failed to delete account" +
          (error instanceof Error ? `: ${error.message}` : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="jqzz-modal-overlay" onClick={onClose}>
        {name && <h1 className="jqzz-identity-modal-name">{name}</h1>}
        <div className="surface-imperfection-light-full">
          <div className="surface-imperfection-light-scratch">
            <div className="surface-imperfection-floor">
              <div className="jqzz-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{current ? "# Set Identity" : "# Create Account"}</h3>

                {handle && <h2 className="tag">_{handle}_</h2>}

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
                    <div
                      className="jqzz-field-label"
                      style={{ marginBottom: 5 }}
                    >
                      Handle
                    </div>
                    <input
                      className="jqzz-modal-input"
                      placeholder="@handle"
                      value={handle}
                      onChange={(e) =>
                        setHandle(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, ""),
                        )
                      }
                    />
                    <div
                      className="jqzz-field-label"
                      style={{ marginBottom: 5 }}
                    >
                      Email
                    </div>
                    <input
                      className="jqzz-modal-input"
                      placeholder="email@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="jqzz-field-label">Profile Picture</div>
                    <ImagePicker
                      value={profilePictureUrl}
                      onChange={setProfilePictureUrl}
                    />
                    {profilePictureUrl && (
                      <button
                        type="button"
                        className="jqzz-modal-btn"
                        onClick={() => setProfilePictureUrl("")}
                        style={{ marginTop: "4px", width: "100%" }}
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}

                <div className="jqzz-modal-row" style={{ marginTop: "8px" }}>
                  {!current && !showLogin ? (
                    <>
                      <button
                        className="jqzz-modal-btn"
                        onClick={() => setShowLogin(true)}
                      >
                        Login
                      </button>
                      <button
                        className="jqzz-modal-btn primary"
                        onClick={handleSave}
                        disabled={loading || !name.trim()}
                      >
                        {loading ? "Creating..." : "Create"}
                      </button>
                    </>
                  ) : showLogin ? (
                    <>
                      <div style={{ width: "100%", marginBottom: "8px" }}>
                        <div className="jqzz-field-label">User ID</div>
                        <input
                          className="jqzz-modal-input"
                          placeholder="Enter your user ID"
                          value={loginId}
                          onChange={(e) => setLoginId(e.target.value)}
                        />
                      </div>
                      <div className="jqzz-modal-row" style={{ width: "100%" }}>
                        <button
                          className="jqzz-modal-btn"
                          onClick={() => setShowLogin(false)}
                        >
                          Back
                        </button>
                        <button
                          className="jqzz-modal-btn primary"
                          onClick={handleLogin}
                          disabled={loading || !loginId.trim()}
                        >
                          {loading ? "Logging in..." : "Login"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        className="jqzz-modal-btn"
                        onClick={handleLogout}
                        disabled={loading}
                      >
                        Logout
                      </button>
                      <button
                        className="jqzz-modal-btn"
                        onClick={handleDeleteAccount}
                        disabled={loading}
                      >
                        Delete Account
                      </button>
                      <button
                        className="jqzz-modal-btn primary"
                        onClick={handleSave}
                        disabled={loading}
                      >
                        {loading ? "Saving..." : "Save"}
                      </button>
                    </>
                  )}
                </div>
                <div className="jqzz-modal-row" style={{ marginTop: "8px" }}>
                  <button
                    className="jqzz-modal-btn"
                    onClick={onClose}
                    disabled={loading}
                    style={{ width: "100%" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
