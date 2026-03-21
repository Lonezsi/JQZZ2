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

interface AuthContextType {
  user: User | null;
  login: (id: string) => Promise<User>;
  register: (name: string) => Promise<User | undefined>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {
    throw new Error("login not implemented");
  },
  register: async () => undefined,
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
    async (name: string): Promise<User | undefined> => {
      try {
        const res = await userService.register({ name });
        const user = await login(res.data.userId);
        return user;
      } catch (error) {
        console.error("Registration failed, using fallback user", error);
        // Fallback: use a local user object
        const fallbackUser: User = {
          id: "guest",
          name: name || "Guest",
          handle: "guest",
          online: true,
        };
        setUser(fallbackUser);
        localStorage.setItem("userId", fallbackUser.id);
        return fallbackUser;
      }
    },
    [login],
  );

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
          register("Guest").finally(() => setLoading(false));
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      register("Guest").finally(() => setLoading(false));
    }
  }, [register]);

  const logout = useCallback(async () => {
    if (user) {
      await userService.logout(user.id);
      setUser(null);
      localStorage.removeItem("userId");
    }
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
