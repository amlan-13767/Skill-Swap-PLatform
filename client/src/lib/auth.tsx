import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

type AuthUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  location: string | null;
  avatar: string | null;
  skillsOffered: string[] | null;
  skillsWanted: string[] | null;
  availability: string[];
  rating: number;
  isPublic: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  register: (userData: unknown) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  updateUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await response.json();
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Login failed" };
    }
  };

  const register = async (userData: unknown) => {
    try {
      const response = await apiRequest("POST", "/api/auth/register", userData);
      const data = await response.json();
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Registration failed" };
    }
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, isLoggedIn: Boolean(user), loading, login, register, updateUser: setUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
