import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { loadGameSave, saveGameSave, type GameKey } from "@/lib/game-saves.functions";
import type { Json } from "@/integrations/supabase/types";

export function useCloudSave<T>(opts: {
  key: GameKey;
  storageKey: string;
  state: T | null;
  setState: (s: T) => void;
}) {
  const { key, storageKey, state, setState } = opts;
  const { user } = useAuth();
  const hydratedRef = useRef<string | null>(null); // store user id, not just boolean

  // On sign-in (or user change), pull cloud save down
  useEffect(() => {
    if (!user) {
      hydratedRef.current = null; // reset on sign-out
      return;
    }
    if (hydratedRef.current === user.id) return; // already hydrated for this user
    hydratedRef.current = user.id;

    (async () => {
      try {
        const res   = await loadGameSave(key);
        const cloud = res?.data;
        if (cloud && typeof cloud === "object") {
          setState(cloud as T);
          try { localStorage.setItem(storageKey, JSON.stringify(cloud)); } catch { /* ignore */ }
        } else {
          // No cloud save yet — push local state up
          const local   = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
          const payload = local ? JSON.parse(local) : state;
          if (payload) await saveGameSave(key, payload as Json);
        }
      } catch (e) {
        console.warn("[cloud-save] hydrate failed", e);
      }
    })();
  }, [user, key, storageKey, setState, state]);

  // Debounced auto-save: write to cloud 10 seconds after state changes
  useEffect(() => {
    if (!user || !state) return;
    const id = setTimeout(() => {
      saveGameSave(key, state as Json).catch((e) => console.warn("[cloud-save] save failed", e));
    }, 10_000);
    return () => clearTimeout(id);
  }, [state, user, key]);
}
