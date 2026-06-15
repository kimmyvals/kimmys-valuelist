import { supabase } from "@/integrations/supabase/client";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dailyRng(dateKey: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function submitDailyScore(score: number): Promise<{ ok: boolean; kept: number }> {
  const s = Math.floor(Number(score));
  if (!Number.isFinite(s) || s < 0 || s > 1_000_000) throw new Error("Invalid score.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, kept: 0 };

  const date = todayKey();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", session.user.id)
    .maybeSingle();
  const username = profile?.username ?? "player";

  const { data: existing } = await supabase
    .from("daily_scores")
    .select("score")
    .eq("user_id", session.user.id)
    .eq("game_date", date)
    .maybeSingle();

  if (existing && existing.score >= s) return { ok: true, kept: existing.score };

  if (existing) {
    const { error } = await supabase
      .from("daily_scores")
      .update({ score: s, username })
      .eq("user_id", session.user.id)
      .eq("game_date", date);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("daily_scores")
      .insert({ user_id: session.user.id, game_date: date, score: s, username });
    if (error) throw new Error(error.message);
  }

  return { ok: true, kept: s };
}

export async function getDailyLeaderboard(): Promise<{ date: string; entries: { username: string; score: number }[] }> {
  const date = todayKey();
  const { data, error } = await supabase
    .from("daily_scores")
    .select("username, score")
    .eq("game_date", date)
    .order("score", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { date, entries: data ?? [] };
}
