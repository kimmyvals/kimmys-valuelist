import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type GameKey = "market" | "memorize" | "cases" | "snowfall" | "daily";

export async function loadGameSave(key: GameKey): Promise<{ data: Json | null; updatedAt: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, updatedAt: null };
  const { data: row } = await supabase
    .from("game_saves")
    .select("data, updated_at")
    .eq("user_id", session.user.id)
    .eq("game_key", key)
    .maybeSingle();
  return { data: (row?.data ?? null) as Json | null, updatedAt: row?.updated_at ?? null };
}

export async function saveGameSave(key: GameKey, saveData: Json): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const serialized = JSON.stringify(saveData ?? {});
  if (serialized.length > 256 * 1024) throw new Error("Save data is too large.");
  const { error } = await supabase
    .from("game_saves")
    .upsert(
      { user_id: session.user.id, game_key: key, data: saveData },
      { onConflict: "user_id,game_key" },
    );
  if (error) throw new Error(error.message);
}
