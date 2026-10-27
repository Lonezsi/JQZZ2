import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { go } from "../../hooks/useHashRoute";
import { playService } from "../../services/playService";
import { errorMessage } from "../../services/api";
import { PlayFrame } from "./PlayCommon";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

/** Type the code off the host's screen, or arrive with it in the link. */
export const JoinScreen: React.FC<{ code?: string }> = ({ code: fromLink }) => {
  const { user } = useAuth();
  const [code, setCode] = useState(clean(fromLink ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const join = async (c: string) => {
    if (!user || c.length < 5) return;
    setBusy(true);
    setError(null);
    try {
      await playService.join(c, user.id);
      go(`/play/${c}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  // a link with the code in it joins straight away
  useEffect(() => {
    const c = clean(fromLink ?? "");
    if (c.length === 5 && user && !tried.current) {
      tried.current = true;
      join(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLink, user]);

  return (
    <PlayFrame>
      <div className="jqzz-play-center jqzz-join">
        <h1 className="jqzz-stage-title OEF jqzz-chroma">join a game</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            join(code);
          }}
        >
          <input
            className="jqzz-join-input"
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            placeholder="CODE"
            aria-label="Join code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
          />
          <button className="jqzz-play-btn primary big" disabled={code.length < 5 || busy}>
            {busy ? "joining…" : "join"}
          </button>
        </form>
        {error && <p className="jqzz-play-note bad">{error}</p>}
        <p className="jqzz-play-note">
          playing as <b>{user?.name}</b>. you can change it once you're in.
        </p>
        <button className="jqzz-play-btn ghost" onClick={() => go("/")}>
          make a quiz instead
        </button>
      </div>
    </PlayFrame>
  );
};
