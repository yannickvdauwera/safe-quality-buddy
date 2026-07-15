import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hse_manager" | "manager" | "gebruiker";

const PREVIEW_KEY = "roles.preview";
const PREVIEW_EVENT = "roles.preview.changed";

function readPreview(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PREVIEW_KEY);
  return v === "admin" || v === "hse_manager" || v === "manager" || v === "gebruiker" ? v : null;
}

export function setPreviewRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(PREVIEW_KEY, role);
  else window.localStorage.removeItem(PREVIEW_KEY);
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth(): AuthState & {
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
  realRoles: AppRole[];
  previewRole: AppRole | null;
  isPreviewing: boolean;
  setPreviewRole: (r: AppRole | null) => void;
} {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    roles: [],
    loading: true,
  });
  const [previewRole, setPreviewState] = useState<AppRole | null>(() => readPreview());

  useEffect(() => {
    const onChange = () => setPreviewState(readPreview());
    window.addEventListener(PREVIEW_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string): Promise<AppRole[]> => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return (data ?? []).map((r) => r.role as AppRole);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        setTimeout(async () => {
          const roles = await loadRoles(session.user.id);
          if (mounted) setState((s) => ({ ...s, roles }));
        }, 0);
      } else {
        setState((s) => ({ ...s, roles: [] }));
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const roles = session?.user ? await loadRoles(session.user.id) : [];
      if (!mounted) return;
      setState({ session, user: session?.user ?? null, roles, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const realRoles = state.roles;
  const isAdmin = realRoles.includes("admin");
  const activePreview = isAdmin ? previewRole : null;
  const effectiveRoles: AppRole[] = activePreview ? [activePreview] : realRoles;

  return {
    ...state,
    roles: effectiveRoles,
    hasRole: (r) => effectiveRoles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => effectiveRoles.includes(r)),
    realRoles,
    previewRole: activePreview,
    isPreviewing: !!activePreview,
    setPreviewRole,
  };
}
