import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import type { User } from "../types";
import { userService } from "../services/userService";
import { api } from "../services/api";

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

    const stored = localStorage.getItem("userId");
    if (stored) {
      userService
        .getOne(stored)
        .then((res) => {
          setUser(res.data);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem("userId");
          const randomSuffix = Math.floor(Math.random() * 10000);
          register(`Guest_${randomSuffix}`)
            .then(() => setLoading(false))
            .catch((err) => {
              console.error("Failed to create user", err);
              setLoading(false);
            });
        });
    } else {
      const randomSuffix = Math.floor(Math.random() * 10000);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      register(`Guest_${randomSuffix}`)
        .then(() => setLoading(false))
        .catch((err) => {
          console.error("Failed to create user", err);
          setLoading(false);
        });
    }
  }, [register]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        const url = `${api.defaults.baseURL}/users/logout`;
        const body = JSON.stringify({ id: user.id });
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
        }).catch((err) => console.error("Logout beacon failed", err));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  if (loading) {
    return <div className="jqzz-dash">Initializing user...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
