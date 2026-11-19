import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import supabase, { api } from "../lib/supabase";
import type { Profile, Theme } from "../lib/types";
interface AppState {
  user: User | null;
  loading: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  notify: (s: string) => void;
  toast: string;
  pendingFile: File | null;
  setPendingFile: (f: File | null) => void;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
}
const C = createContext<AppState>(null!);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [theme, setTheme] = useState<Theme>(
      () => (localStorage.getItem("research-theme") as Theme) || "light",
    ),
    [toast, notify] = useState(""),
    [pendingFile, setPendingFile] = useState<File | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user || null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await api<Profile>("profile");
    setProfile(p);
    setTheme(p.theme);
  }, [user]);
  useEffect(() => {
    if (user) void refreshProfile().catch(() => {});
    else setProfile(null);
  }, [user, refreshProfile]);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    }
    apply();
    localStorage.setItem("research-theme", theme);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => notify(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <C.Provider
      value={{
        user,
        loading,
        theme,
        setTheme,
        notify,
        toast,
        pendingFile,
        setPendingFile,
        profile,
        refreshProfile,
      }}
    >
      {children}
    </C.Provider>
  );
}
export const useApp = () => useContext(C);
