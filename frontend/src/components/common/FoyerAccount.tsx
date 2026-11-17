import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/userService";
import { errorMessage } from "../../services/api";

/**
 * Your account and Foyer, the home server's one sign-in: tied (it opens as you wherever
 * you're signed in on Foyer, untie), signed in on Foyer but not tied (connect), or not
 * signed in there (a link to do it). Looks like the Google row on purpose: same job.
 */
export const FoyerAccount: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { user, updateUser } = useAuth();
  const [foyer, setFoyer] = useState<{ handle: string; name: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    userService
      .foyerWho()
      .then((res) => live && setFoyer(res.data.foyer))
      .catch(() => live && setFoyer(null));
    return () => {
      live = false;
    };
  }, []);
  if (!user || foyer === undefined) return null;

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
  const tie = () =>
    run(async () => {
      updateUser((await userService.foyerLink(user.id)).data);
    });
  const untie = () =>
    run(async () => {
      await userService.foyerUnlink(user.id);
      updateUser({ foyerLinked: false });
    });

  return (
    <div className={`jqzz-google jqzz-foyer${user.foyerLinked ? " linked" : ""} ${className}`}>
      {user.foyerLinked ? (
        <>
          <span>tied to Foyer{foyer ? ` · @${foyer.handle}` : ""}. opens as you wherever you're signed in there.</span>
          <button type="button" className="jqzz-modal-btn ghost" onClick={untie} disabled={busy}>
            Untie
          </button>
        </>
      ) : foyer ? (
        <>
          <span className="jqzz-optional">signed in on Foyer as @{foyer.handle}. connect it and this account opens on any device.</span>
          <button type="button" className="jqzz-modal-btn" onClick={tie} disabled={busy}>
            Connect to Foyer
          </button>
        </>
      ) : (
        <>
          <span className="jqzz-optional">one sign-in for every site on this server.</span>
          <a className="jqzz-modal-btn ghost" href="/foyer/account?next=/jqzz/">
            Sign in on Foyer
          </a>
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
