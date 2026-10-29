import React, { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";

/* Signing in with Google from our own button: Google's popup hands back an
   access token, and the server checks it with Google before trusting it. The
   server says which client id to use; with none, Google sign-in is off and
   nothing shows. */

interface TokenClient {
  requestAccessToken: () => void;
}
interface GoogleOAuth {
  initTokenClient: (o: {
    client_id: string;
    scope: string;
    callback: (r: { access_token?: string; error?: string }) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }) => TokenClient;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth } };
  }
}

let clientId: Promise<string> | null = null;
/** the server's Google client id, asked once; "" when it's off */
// eslint-disable-next-line react-refresh/only-export-components
export function googleClientId(): Promise<string> {
  clientId ??= api
    .get<{ clientId: string }>("/users/google/config")
    .then((r) => r.data.clientId ?? "")
    .catch(() => "");
  return clientId;
}

let script: Promise<GoogleOAuth> | null = null;
function loadGoogle(): Promise<GoogleOAuth> {
  script ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () =>
      window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error("no google"));
    s.onerror = () => {
      script = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return script;
}

/** Whether Google sign-in is on here: null while asking. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGoogleEnabled() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    googleClientId().then((id) => live && setOn(!!id));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/** Google's "G", in its own colours: its sign-in buttons are meant to carry it. */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

export const GoogleButton: React.FC<{
  label?: string;
  disabled?: boolean;
  onCredential: (accessToken: string) => void;
}> = ({ label = "continue with Google", disabled = false, onCredential }) => {
  const client = useRef<TokenClient | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  });

  // ready before the click: the popup has to open straight from it
  useEffect(() => {
    let live = true;
    Promise.all([googleClientId(), loadGoogle()])
      .then(([id, oauth]) => {
        if (!live || !id) return;
        client.current = oauth.initTokenClient({
          client_id: id,
          scope: "openid email profile",
          callback: (r) => {
            if (r.access_token) callback.current(r.access_token);
            else if (r.error) setFailed("Google sign-in didn't go through");
          },
          error_callback: (e) => {
            // closing the popup isn't a failure worth a message
            if (e.type !== "popup_closed") setFailed("Google sign-in didn't go through");
          },
        });
        setReady(true);
      })
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="jqzz-google-btn"
        disabled={!ready || disabled}
        onClick={() => {
          setFailed(null);
          client.current?.requestAccessToken();
        }}
      >
        <GoogleG />
        {label}
      </button>
      {failed && <p className="jqzz-annot">{failed}</p>}
    </>
  );
};
