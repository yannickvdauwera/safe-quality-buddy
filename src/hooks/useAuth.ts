import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hse_manager" | "manager" | "operator";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth(): AuthState & {
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
} {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    roles: [],
    loading: true,
  });

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

  return {
    ...state,
    hasRole: (r) => state.roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => state.roles.includes(r)),
  };
}
