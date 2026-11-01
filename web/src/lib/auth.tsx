import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./db-types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** true khi tài khoản đã bật MFA nhưng phiên hiện tại chưa xác minh mã (aal1 → aal2). */
  needsMfa: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setNeedsMfa(false);
      setLoading(false);
      return;
    }
    const [{ data: prof }, aal] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", s.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setProfile((prof as Profile | null) ?? null);
    const lvl = aal.data;
    setNeedsMfa(!!lvl && lvl.nextLevel === "aal2" && lvl.currentLevel !== "aal2");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) void load(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Không gọi API Supabase đồng bộ trong callback (khuyến nghị của supabase-js).
      setTimeout(() => {
        if (active) void load(s);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        profile,
        isAdmin: profile?.role === "admin",
        needsMfa,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong AuthProvider");
  return ctx;
}
