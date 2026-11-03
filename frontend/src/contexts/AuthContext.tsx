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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const initializing = useRef(false);

  // the account as the server sent it to its owner: its key goes in this browser only
  const signedIn = useCallback((u: User): User => {
    // the old stored id goes only once a key has come to replace it
    if (u.loginKey) {
      localStorage.setItem(KEY_STORE, u.loginKey);
      localStorage.removeItem("userId");
    }
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
      localStorage.removeItem(KEY_STORE);
    }
  }, [user]);

  useEffect(() => {
    if (initializing.current) return;
    initializing.current = true;

    // Keep the stored identity unless the server says it no longer exists:
    // a backend that is down or restarting must not cost the user their account.
    const restore = async (attempt: number) => {
      const key = localStorage.getItem(KEY_STORE);
      // from before login keys: this browser only knows the account's id, and
      // trades it for a key once
      const legacyId = localStorage.getItem("userId");
      try {
        if (key || legacyId) {
          try {
            if (key) await login(key);
            else signedIn((await userService.login({ id: legacyId! })).data);
          } catch (err) {
            const gone = axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 401);
            if (!gone) throw err;
            localStorage.removeItem(KEY_STORE);
            localStorage.removeItem("userId");
            await register(guestName());
          }
        } else {
          await register(guestName());
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

  if (loading) {
    return (
      <div className="jqzz-app">
        <div className="jqzz-status-screen" role="status">
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
