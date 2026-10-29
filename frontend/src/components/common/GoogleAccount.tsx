import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";
import { errorMessage } from "../../services/api";
import { GoogleButton, useGoogleEnabled } from "./GoogleButton";

/**
 * Your account and Google: tied (sign in anywhere, untie), or a guest account
 * with the button that ties it. Nothing at all when Google sign-in is off.
 */
export const GoogleAccount: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { user, updateUser } = useAuth();
  const on = useGoogleEnabled();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!on || !user) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const tie = (credential: string) =>
    run(async () => {
      const res = await userService.googleLink(user.id, credential);
      updateUser(res.data);
    });
  const untie = () =>
    run(async () => {
      await userService.googleUnlink(user.id);
      updateUser({ googleLinked: false });
    });

  return (
    <div className={`jqzz-google${user.googleLinked ? " linked" : ""} ${className}`}>
      {user.googleLinked ? (
        <>
          <span>tied to Google{user.email ? ` · ${user.email}` : ""}. sign in with it anywhere.</span>
          <button type="button" className="jqzz-modal-btn ghost" onClick={untie} disabled={busy}>
            Untie
          </button>
        </>
      ) : (
        <>
          <span className="jqzz-optional">
            a guest account only lives in this browser. tie it to Google to keep it and sign in anywhere.
          </span>
          <GoogleButton label="tie it to Google" disabled={busy} onCredential={tie} />
        </>
      )}
      {error && (
        <p className="jqzz-modal-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
