import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser]         = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isEditor, setIsEditor] = useState(false);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async (u: User | null) => {
      if (!u) {
        if (!cancelled) {
          setUser(null);
          setIsEditor(false);
          setIsAdmin(false);
          setUsername(null);
          setLoading(false);
        }
        return;
      }
      // Set user immediately so UI can show logged-in state
      if (!cancelled) setUser(u);
      try {
        const [{ data: roles }, { data: profile }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", u.id),
          supabase.from("profiles").select("username").eq("user_id", u.id).maybeSingle(),
        ]);
        if (cancelled) return;
        const roleSet = new Set((roles ?? []).map((r) => r.role));
        setIsAdmin(roleSet.has("admin"));
        setIsEditor(roleSet.has("editor") || roleSet.has("admin"));
        setUsername(profile?.username ?? null);
      } catch (err) {
        console.error("Auth hydration error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Listen for future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      hydrate(session?.user ?? null);
    });

    // Hydrate from existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      hydrate(data.session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, username, isEditor, isAdmin, loading };
}
