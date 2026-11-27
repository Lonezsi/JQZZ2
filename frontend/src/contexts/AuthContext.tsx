import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import axios from "axios";
import type { User } from "../types";
import { InSpace } from "../components/common/InSpace";
import { userService } from "../services/userService";
import { KEY_STORE } from "../services/api";
import { guestName } from "../utils/guestName";

interface AuthContextType {
  user: User | null;
  /** with a login key */
  login: (key: string) => Promise<User>;
  register: (name: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {
    throw new Error("login not implemented");
  },
  register: async () => {
    throw new Error("register not implemented");
  },
  logout: async () => {},
  updateUser: () => {},
});

/** how long the first load stays on the loading planet at the least, in ms since the page began loading */
const BOOT_MIN_MS = 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  // the site waits on the loading planet for BOOT_MIN_MS from when the page began to load,
  // or for however long it took to load, whichever is more
  const [held, setHeld] = useState(() => performance.now() < BOOT_MIN_MS);
  useEffect(() => {
    if (!held) return;
    const t = window.setTimeout(() => setHeld(false), Math.max(0, BOOT_MIN_MS - performance.now()));
    return () => window.clearTimeout(t);
  }, [held]);
  const initializing = useRef(false);

  // the account as the server sent it to its owner: its key goes in this browser only
  const signedIn = useCallback((u: User): User => {
    // the key lives in the HttpOnly cookie the server just set; nothing of it stays in the page's storage
    localStorage.removeItem(KEY_STORE);
    localStorage.removeItem("userId");
    setUser(u);
    return u;
  }, []);

  const login = useCallback(
    async (key: string): Promise<User> => signedIn((await userService.login({ key })).data),
    [signedIn],
  );

  const register = useCallback(
    async (name: string): Promise<User> => signedIn((await userService.register({ name })).data),
    [signedIn],
  );

  const logout = useCallback(async () => {
    if (user) {
      await userService.logout(user.id);
      setUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (initializing.current) return;
    initializing.current = true;

    // Signed in on Foyer (the home server's one sign-in, its cookie arrives with every
    // request): the account tied to it, or a new one made from it. False when nobody is
    // signed in there, or Foyer can't be asked.
    const foyerLogin = async (): Promise<boolean> => {
      try {
        signedIn((await userService.foyerLogin()).data);
        return true;
      } catch {
        return false;
      }
    };
    // An account this browser already had gets tied to the Foyer account, so other devices
    // signed in on Foyer open it too. If that Foyer account already has its own account
    // here and this one is only a guest, the Foyer one wins: a guest is nobody yet.
    const foyerTie = async (u: User) => {
      if (u.foyerLinked) return;
      try {
        signedIn((await userService.foyerLink(u.id)).data);
      } catch (err) {
        const taken = axios.isAxiosError(err) && err.response?.status === 409;
        if (taken && !u.googleLinked && (u.name ?? "").endsWith("(guest)")) await foyerLogin();
      }
    };

    // Keep the stored identity unless the server says it no longer exists:
    // a backend that is down or restarting must not cost the user their account.
    const restore = async (attempt: number) => {
      // a browser from before the cookie-only key: trade the stored key for the cookie once
      // (signedIn then wipes it from storage)
      const oldKey = localStorage.getItem(KEY_STORE);
      try {
        try {
          const u = oldKey ? await login(oldKey) : signedIn((await userService.me()).data);
          await foyerTie(u);
        } catch (err) {
          const gone = axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 401);
          if (!gone) throw err;
          localStorage.removeItem(KEY_STORE);
          localStorage.removeItem("userId");
          if (!(await foyerLogin())) await register(guestName());
        }
        setUnreachable(false);
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize user, retrying", err);
        setUnreachable(true);
        setTimeout(() => restore(attempt + 1), Math.min(10000, 1000 * 2 ** attempt));
      }
    };
    restore(0);
  }, [login, register, signedIn]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  if (loading || held) {
    return (
      <div className="jqzz-app">
        <InSpace place="loading" />
        <div className="jqzz-status-screen" role="status">
          {!unreachable && <span className="jqzz-spinner" aria-hidden="true" />}
          <span className="jqzz-annot">{unreachable ? "server · down" : "server · connecting"}</span>
          <p>
            {unreachable
              ? "can't reach the server. is the backend running? trying again..."
              : "logging you in..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
