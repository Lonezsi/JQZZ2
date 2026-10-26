import React, { useState } from "react";
import axios from "axios";
import type { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";
import { errorMessage } from "../../services/api";
import { avatarSeed, guestName } from "../../utils/guestName";
import { Avatar } from "../common/Avatar";
import { ImagePicker } from "./ImagePicker";
import type { PresenceState } from "../../hooks/usePresence";

interface IdentityModalProps {
  state?: PresenceState;
  current: User | null;
  onSave: (user: User) => void;
  onClose: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  state = "open",
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
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setError(`couldn't save: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const user = await login(loginId.trim());
      onSave(user);
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 404
          ? "no user with that id."
          : `couldn't log in: ${errorMessage(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await logout();
      const newUser = await register(guestName());
      onSave(newUser);
      onClose();
    } catch (err) {
      setError(`couldn't log out: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!current) return;
    if (!confirm("delete your account? this can't be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      await userService.delete(current.id);
      const newUser = await register(guestName());
      onSave(newUser);
    } catch (err) {
      setError(`couldn't delete it: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jqzz-modal-overlay" data-state={state} onClick={onClose}>
      <div className="jqzz-overlay-bloom" aria-hidden="true" />
      {name && (
        <div className="jqzz-identity-modal-name OEF" aria-hidden="true">
          {name}
        </div>
      )}
      <div
        className="jqzz-modal jqzz-holo"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jqzz-identity-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jqzz-holo-dots" aria-hidden="true" />
        <div className="jqzz-holo-dust" aria-hidden="true" />
        <div className="jqzz-modal-head">
          <h3 id="jqzz-identity-title" className="jqzz-chroma">
            {showLogin ? "log in" : current ? "you" : "new account"}
          </h3>
          {/* out of focus until you look at it */}
          {handle && !showLogin && <span className="jqzz-handle-glow">_{handle}_</span>}
        </div>

        {showLogin ? (
          <>
            <label className="jqzz-field-label" htmlFor="jqzz-login-id">
              user id
            </label>
            <input
              id="jqzz-login-id"
              className="jqzz-modal-input"
              placeholder="the 10 letter id from your other browser"
              value={loginId}
              autoFocus
              onChange={(e) => setLoginId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </>
        ) : (
          <>
            <label className="jqzz-field-label" htmlFor="jqzz-name">
              name
            </label>
            <div className="jqzz-modal-inline">
              <input
                id="jqzz-name"
                className="jqzz-modal-input"
                placeholder="e.g. lonezsi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="button"
                className="jqzz-dice"
                onClick={() => setName(guestName())}
                title="random name"
                aria-label="Random name"
              >
                <span aria-hidden="true">⚄</span>
              </button>
            </div>
            {current && (
              <>
                <label className="jqzz-field-label" htmlFor="jqzz-handle">
                  handle
                </label>
                <input
                  id="jqzz-handle"
                  className="jqzz-modal-input"
                  placeholder="letters and numbers only"
                  value={handle}
                  onChange={(e) =>
                    setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                  }
                />
                <label className="jqzz-field-label" htmlFor="jqzz-email">
                  email <span className="jqzz-optional">optional</span>
                </label>
                <input
                  id="jqzz-email"
                  className="jqzz-modal-input"
                  placeholder="email@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="jqzz-field-label">picture</div>
                <div className="jqzz-modal-picture">
                  <Avatar
                    user={{ id: current.id, name, profilePictureUrl }}
                    viewerId={current.id}
                    className="jqzz-identity-preview"
                  />
                  <ImagePicker
                    value={profilePictureUrl.startsWith("gen:") ? "" : profilePictureUrl}
                    onChange={setProfilePictureUrl}
                  />
                  <button
                    type="button"
                    className="jqzz-dice"
                    onClick={() => setProfilePictureUrl(avatarSeed())}
                    title="random picture"
                    aria-label="Random picture"
                  >
                    <span aria-hidden="true">⚄</span>
                  </button>
                  {profilePictureUrl && (
                    <button
                      type="button"
                      className="jqzz-modal-btn ghost"
                      onClick={() => setProfilePictureUrl("")}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <label className="jqzz-field-label" htmlFor="jqzz-id">
                  your id <span className="jqzz-optional">log in with it somewhere else</span>
                </label>
                <input
                  id="jqzz-id"
                  className="jqzz-modal-input mono"
                  readOnly
                  value={current.id}
                  onFocus={(e) => e.target.select()}
                />
              </>
            )}
          </>
        )}

        {error && (
          <p className="jqzz-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="jqzz-modal-row">
          {showLogin ? (
            <>
              <button className="jqzz-modal-btn" onClick={() => setShowLogin(false)}>
                Back
              </button>
              <button
                className="jqzz-modal-btn primary"
                onClick={handleLogin}
                disabled={loading || !loginId.trim()}
              >
                {loading ? "logging in…" : "Log in"}
              </button>
            </>
          ) : !current ? (
            <>
              <button className="jqzz-modal-btn" onClick={() => setShowLogin(true)}>
                Log in instead
              </button>
              <button
                className="jqzz-modal-btn primary"
                onClick={handleSave}
                disabled={loading || !name.trim()}
              >
                {loading ? "making it…" : "Create"}
              </button>
            </>
          ) : (
            <>
              <button className="jqzz-modal-btn" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="jqzz-modal-btn primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "saving…" : "Save"}
              </button>
            </>
          )}
        </div>

        {current && !showLogin && (
          <div className="jqzz-modal-row secondary">
            <button className="jqzz-modal-btn ghost" onClick={handleLogout} disabled={loading}>
              Log out
            </button>
            <button
              className="jqzz-modal-btn ghost"
              onClick={() => {
                setError(null);
                setShowLogin(true);
              }}
              disabled={loading}
            >
              Switch user
            </button>
            <button
              className="jqzz-modal-btn ghost danger"
              onClick={handleDeleteAccount}
              disabled={loading}
            >
              Delete account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
