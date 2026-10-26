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
import { guestName } from "../utils/guestName";
import { Atmosphere } from "../components/common/Atmosphere";

interface AuthContextType {
  user: User | null;
  login: (id: string) => Promise<User>;
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

  const login = useCallback(async (id: string): Promise<User> => {
    const res = await userService.login({ id });
    setUser(res.data);
    localStorage.setItem("userId", res.data.id);
    return res.data;
  }, []);

  const register = useCallback(
    async (name: string): Promise<User> => {
      const res = await userService.register({ name });
      const user = await login(res.data.id);
      return user;
    },
    [login],
  );

  const logout = useCallback(async () => {
    if (user) {
      await userService.logout(user.id);
      setUser(null);
      localStorage.removeItem("userId");
    }
  }, [user]);

  useEffect(() => {
    if (initializing.current) return;
    initializing.current = true;

    // Keep the stored identity unless the server says it no longer exists:
    // a backend that is down or restarting must not cost the user their account.
    const restore = async (attempt: number) => {
      const stored = localStorage.getItem("userId");
      try {
        if (stored) {
          try {
            await login(stored);
          } catch (err) {
            if (!axios.isAxiosError(err) || err.response?.status !== 404) throw err;
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
  }, [login, register]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  if (loading) {
    return (
      <div className="jqzz-app">
        <Atmosphere />
        <div className="jqzz-status-screen" role="status">
          <span className="jqzz-annot">{unreachable ? "server · down" : "server · connecting"}</span>
          <p>
            {unreachable
              ? "can't reach the server. is the backend running? trying again…"
              : "logging you in…"}
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
