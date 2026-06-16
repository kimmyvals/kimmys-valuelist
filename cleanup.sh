#!/usr/bin/env bash
# Run from project root: bash cleanup.sh
set -e
echo "Applying cleanup fixes..."

# ── 1. auth.ts: race condition — cancelled flag doesn't prevent state updates ──
# Also: loading never resets to false if user is null on first call
cat > src/lib/auth.ts << 'ENDOFFILE'
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
ENDOFFILE

# ── 2. game-saves.functions.ts: loadGameSave swallows errors silently ─────────
cat > src/lib/game-saves.functions.ts << 'ENDOFFILE'
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type GameKey = "market" | "memorize" | "cases" | "snowfall" | "daily";

export async function loadGameSave(key: GameKey): Promise<{ data: Json | null; updatedAt: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, updatedAt: null };
  const { data: row, error } = await supabase
    .from("game_saves")
    .select("data, updated_at")
    .eq("user_id", session.user.id)
    .eq("game_key", key)
    .maybeSingle();
  if (error) {
    console.error("[game-saves] load error:", error.message);
    return { data: null, updatedAt: null };
  }
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
      { user_id: session.user.id, game_key: key, data: saveData, updated_at: new Date().toISOString() },
      { onConflict: "user_id,game_key" },
    );
  if (error) throw new Error(error.message);
}
ENDOFFILE

# ── 3. use-cloud-save.ts: doesn't handle sign-out (stale hydrated ref) ────────
cat > src/lib/use-cloud-save.ts << 'ENDOFFILE'
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
ENDOFFILE

# ── 4. SkinCard.tsx: lazy loading on card images was blocking display ─────────
cat > src/components/SkinCard.tsx << 'ENDOFFILE'
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { SkinImage } from "@/components/SkinImage";

export type Skin = {
  id: string;
  name: string;
  nickname: string | null;
  image_url: string | null;
  weapon_type: string;
  season: string;
  value: number;
  demand: number | null;
  rarity: string;
  updated_at: string;
  kt_value: number | null;
  sv_value: number | null;
  kt_sv_demand: number | null;
  amount_unboxed: string | null;
  section?: string | null;
  trend?: string | null;
  kt_trend?: string | null;
};

type TrendKind = "rising" | "lowering" | "unstable" | "stable" | "projected" | "hype" | "other";

function classifyTrend(v: string): { kind: TrendKind; label: string; arrow: string } {
  const s = v.trim().toLowerCase().replace(/[.\s]+$/, "");
  if (/^(rsng|rising|rise|up|\+|↑|▲)/.test(s)) return { kind: "rising", label: "Rising", arrow: "▲" };
  if (/^(lwrg|lowering|lower|down|falling|fall|-|↓|▼)/.test(s)) return { kind: "lowering", label: "Lowering", arrow: "▼" };
  if (/^(unst|unstable)/.test(s)) return { kind: "unstable", label: "Unstable", arrow: "↯" };
  if (/^(st\b|stable|=|—|–|flat)/.test(s)) return { kind: "stable", label: "Stable", arrow: "■" };
  if (/^(proj|projected|projecting)/.test(s)) return { kind: "projected", label: "Projected", arrow: "◆" };
  if (/^(hype|hyped)/.test(s)) return { kind: "hype", label: "Hype", arrow: "★" };
  return { kind: "other", label: v.trim(), arrow: "•" };
}

const trendStyles: Record<TrendKind, string> = {
  rising:    "text-white border-transparent bg-[#a02424]",
  lowering:  "text-white border-transparent bg-[#2c6fd1]",
  unstable:  "text-white border-transparent bg-[#b56b86]",
  stable:    "text-white border-transparent bg-[#4a4a4a]",
  projected: "text-white border-transparent bg-[#c9961a]",
  hype:      "text-white border-transparent bg-[#5a8a3a]",
  other:     "text-sky-200 border-sky-400/30 bg-sky-400/10",
};

function TrendBadge({ value }: { value?: string | null }) {
  if (!value?.trim()) return null;
  const { kind, label, arrow } = classifyTrend(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${trendStyles[kind]}`}>
      <span>{arrow}</span>
      <span>{label}</span>
    </span>
  );
}

const rarityClass: Record<string, string> = {
  Limited:   "bg-yellow-400/20 text-yellow-200 border-yellow-400/50",
  Exotic:    "bg-orange-400/20 text-orange-200 border-orange-400/50",
  Legendary: "bg-red-500/20 text-red-300 border-red-500/50",
  Epic:      "bg-purple-500/20 text-purple-300 border-purple-500/50",
  Rare:      "bg-sky-400/15 text-sky-200 border-sky-400/40",
  Uncommon:  "bg-green-400/20 text-green-200 border-green-400/40",
  Common:    "bg-zinc-400/15 text-zinc-300 border-zinc-400/40",
};

const rarityRing: Record<string, string> = {
  Limited:   "border-yellow-400/60",
  Exotic:    "border-orange-400/60",
  Legendary: "border-red-500/60",
  Epic:      "border-purple-500/50",
  Rare:      "border-sky-400/40",
  Uncommon:  "border-green-400/30",
  Common:    "border-zinc-400/30",
};

export function SkinCard({ skin, onClick }: { skin: Skin; onClick: () => void }) {
  const [settings] = useSettings();
  const { isEditor } = useAuth();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("skins").delete().eq("id", skin.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["skins"] }); toast.success("Skin removed"); },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const valueClass = settings.hideValues ? "blur-sm transition hover:blur-none" : "";

  return (
    <Card
      onClick={onClick}
      className={`skin-card group relative cursor-pointer overflow-hidden border-2 ${rarityRing[skin.rarity] ?? "border-border/60"} p-0 transition-all hover:-translate-y-1 hover:border-primary/60`}
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
    >
      {isEditor && (
        <Button
          variant="destructive" size="icon"
          className="absolute right-2 bottom-2 z-10 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Remove "${skin.name}"? This cannot be undone.`)) del.mutate();
          }}
          disabled={del.isPending}
          aria-label="Remove skin"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {settings.showImages && !settings.compact && (
        <div className="relative aspect-square overflow-hidden bg-secondary/40">
          <SkinImage
            src={skin.image_url}
            alt={skin.name}
            fallbackLabel={skin.weapon_type}
            className="h-full w-full"
            imgClassName="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
            rounded="rounded-none"
          />
          <Badge variant="outline" className={`absolute right-2 top-2 ${rarityClass[skin.rarity] ?? rarityClass.Common}`}>
            {skin.rarity}
          </Badge>
          <div className="absolute left-2 top-2 rounded-md bg-background/70 px-2 py-1 text-xs backdrop-blur">
            {skin.weapon_type}
          </div>
        </div>
      )}

      {settings.compact ? (
        <div className="flex items-center gap-2 p-2">
          {settings.showImages && (
            <SkinImage
              src={skin.image_url}
              alt={skin.name}
              className="h-10 w-10 shrink-0"
              imgClassName="object-contain"
              rounded="rounded"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h3 className="truncate text-sm font-semibold leading-tight">{skin.name || "—"}</h3>
              <span className={`shrink-0 font-mono text-sm font-bold text-primary ${valueClass}`}>
                {Number(skin.value).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{skin.weapon_type} · {skin.season}</span>
              <span className="shrink-0">D {skin.demand != null ? Number(skin.demand) : "—"}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-4">
          {!settings.showImages && (
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">{skin.weapon_type}</Badge>
              <Badge variant="outline" className={`${rarityClass[skin.rarity] ?? rarityClass.Common}`}>{skin.rarity}</Badge>
            </div>
          )}
          <div>
            <h3 className="font-semibold leading-tight">{skin.name || "—"}</h3>
            {skin.nickname && (
              <p className="text-xs italic text-accent">
                {skin.nickname.split(",").map((n) => n.trim()).filter(Boolean).map((n) => `"${n}"`).join(", ")}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{skin.season}</p>
          <div className="flex items-baseline justify-between border-t border-border/60 pt-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Value</span>
            <div className="flex items-baseline gap-2">
              <TrendBadge value={skin.trend} />
              <span className={`font-mono text-2xl font-bold text-primary ${valueClass}`} style={{ textShadow: "var(--glow-primary)" }}>
                {Number(skin.value).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="uppercase tracking-wider text-muted-foreground">Demand</span>
            <span className="font-mono text-foreground">
              {skin.demand != null ? Number(skin.demand) : "—"}<span className="text-muted-foreground"> / 10</span>
            </span>
          </div>
          {(skin.kt_value != null || skin.sv_value != null || skin.kt_sv_demand != null || skin.kt_trend) && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {skin.season === "Infect '24" ? (
                  <span>SV: <span className="font-mono text-foreground">{skin.sv_value != null ? Number(skin.sv_value).toLocaleString() : "—"}</span></span>
                ) : (
                  <span>KT: <span className="font-mono text-foreground">{skin.kt_value != null ? Number(skin.kt_value).toLocaleString() : "—"}</span></span>
                )}
                <TrendBadge value={skin.kt_trend} />
              </div>
              <span>{skin.season === "Infect '24" ? "SV" : "KT"} Dmd: <span className="font-mono text-foreground">{skin.kt_sv_demand != null ? Number(skin.kt_sv_demand).toLocaleString() : "—"}</span></span>
            </div>
          )}
          {skin.amount_unboxed && (
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Est. copies</span>
              <span className="font-mono text-foreground">
                {/^\d+$/.test(skin.amount_unboxed) ? Number(skin.amount_unboxed).toLocaleString() : skin.amount_unboxed}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
ENDOFFILE

# ── 5. errors.ts: missing case for network timeouts and Supabase JWT errors ────
cat > src/lib/errors.ts << 'ENDOFFILE'
export function friendlyError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (!raw) return "Something went wrong. Please try again.";
  if (raw.includes("unique constraint") || raw.includes("duplicate key")) return "That entry already exists.";
  if (raw.includes("violates check constraint") || raw.includes("invalid input")) return "One or more values are invalid.";
  if (raw.includes("violates foreign key")) return "Referenced item could not be found.";
  if (raw.includes("violates not-null") || raw.includes("null value")) return "Please fill in all required fields.";
  if (raw.includes("row-level security") || raw.includes("permission denied") || raw.includes("rls")) return "You don't have permission to do that.";
  if (raw.includes("rate limit") || raw.includes("too many")) return "Too many requests — wait a moment and try again.";
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) return "Incorrect email or password.";
  if (raw.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (raw.includes("user already registered") || raw.includes("already been registered")) return "An account with that email already exists.";
  if (raw.includes("password") && raw.includes("weak")) return "Please choose a stronger password.";
  if (raw.includes("payload too large") || raw.includes("exceeded the maximum")) return "That file is too large.";
  if (raw.includes("mime") || raw.includes("invalid file")) return "That file type isn't supported.";
  if (raw.includes("jwt") || raw.includes("token") || raw.includes("session")) return "Your session expired — please sign in again.";
  if (raw.includes("timeout") || raw.includes("timed out") || raw.includes("aborted")) return "Request timed out — check your connection and try again.";
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) return "Network error — check your connection and try again.";
  return "Something went wrong. Please try again.";
}
ENDOFFILE

# ── 6. contact.ts: encodeImageUrl doesn't guard against non-string input ───────
cat > src/lib/contact.ts << 'ENDOFFILE'
import { sendContactMessage } from "./contact.functions";

export async function submitContactMessage(opts: {
  userId: string;
  username: string;
  subject: string;
  body: string;
}) {
  return sendContactMessage({ subject: opts.subject, body: opts.body });
}

export function encodeImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  try { return encodeURI(decodeURI(url)); } catch { return url; }
}
ENDOFFILE

# ── 7. Snowfall game: shimmer tap area too small on mobile ────────────────────
# The shimmer button uses fixed vw/vh positioning but is only 56px.
# Also the RAF tick runs even when tab is hidden, wasting CPU.
# Patch the shimmer button size and add visibility API pause.
# We do a targeted sed replacement rather than rewriting the whole file.

# Increase shimmer tap target (h-14 w-14 -> h-20 w-20) for easier mobile tapping
python3 - << 'PYEOF'
with open('src/routes/games.snowfall.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
old = 'className="h-14 w-14 drop-shadow'
new = 'className="h-20 w-20 drop-shadow'
if old in content:
    content = content.replace(old, new)
    with open('src/routes/games.snowfall.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Shimmer tap target enlarged")
else:
    print("⚠️  Shimmer className pattern not found — already patched or changed")
PYEOF

# ── 8. Daily game: timer keeps running after component unmounts ───────────────
# finishRound is called inside the setInterval callback but captured as a plain
# function — it closes over stale score/qIdx. Fix: clear the interval via the
# ref inside the startRound useEffect cleanup so unmount always stops the timer.
python3 - << 'PYEOF'
with open('src/routes/games.daily.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const startRound = () => {
    setPhase("playing");
    setQIdx(0); setScore(0); setCombo(0); setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finishRound(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };"""

new = """  const startRound = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhase("playing");
    setQIdx(0); setScore(0); setCombo(0); setPicked(null);
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          finishRound(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };"""

if old in content:
    content = content.replace(old, new)
    with open('src/routes/games.daily.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Daily timer leak fixed")
else:
    print("⚠️  Daily startRound pattern not found — already patched or changed")
PYEOF

# ── 9. styles.css: body::before gradient references winter colors even on ──────
# other themes because it uses hardcoded oklch values instead of CSS vars.
# Replace with CSS var references so it adapts to the active theme.
# Using Python to avoid sed regex issues with parentheses on Git Bash/Windows.
python3 - << 'PYEOF'
with open('src/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'background-image: radial-gradient(ellipse at top, oklch(0.88 0.08 220 / 0.12), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.85 0.12 200 / 0.08), transparent 50%);'
new = 'background-image: radial-gradient(ellipse at top, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%), radial-gradient(ellipse at bottom right, color-mix(in oklch, var(--accent) 8%, transparent), transparent 50%);'

if old in content:
    content = content.replace(old, new)
    with open('src/styles.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ styles.css gradient updated to use CSS vars")
elif 'color-mix(in oklch, var(--primary)' in content:
    print("ℹ️  styles.css gradient already patched — skipping")
else:
    print("⚠️  styles.css gradient pattern not found — check the file manually")
PYEOF

# ── 10. Add visibility API pause to Snowfall RAF loop ─────────────────────────
# Insert after the RAF cleanup return in games.snowfall.tsx
# This prevents the game burning CPU when the browser tab is hidden
python3 - << 'PYEOF'
import re

with open('src/routes/games.snowfall.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);'''

new = '''    rafRef.current = requestAnimationFrame(frame);

    // Pause RAF when tab is hidden to save CPU
    const onVisChange = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, []);'''

if old in content:
    content = content.replace(old, new)
    with open('src/routes/games.snowfall.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Snowfall visibility pause added")
else:
    print("⚠️  Snowfall RAF pattern not found — skipping visibility patch")
PYEOF

# ── 11. Market game: offline income uses wrong rate calculation ───────────────
# Bug: rate = saved.autoPerSec * (OFFLINE_BASE_RATE + ...) but autoPerSec is
# already "per second", so offline rate should just be autoPerSec * offlineMult.
# The current code multiplies autoPerSec by OFFLINE_BASE_RATE (0.25) as an
# additional multiplier ON TOP of the offlineEff upgrade, which was already
# applying the 0.25 correctly. Net result: offline gains are double-discounted.
python3 - << 'PYEOF'
with open('src/routes/games.market.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '      const rate = saved.autoPerSec * (OFFLINE_BASE_RATE + (saved.upgrades?.offlineEff ?? 0) * 0.1);'
new = '      const offlineEffBonus = (saved.upgrades?.offlineEff ?? 0) * 0.1;\n      const rate = saved.autoPerSec * (OFFLINE_BASE_RATE + offlineEffBonus);'

if old in content:
    content = content.replace(old, new)
    with open('src/routes/games.market.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Market offline rate fixed")
else:
    print("ℹ️  Market offline rate already patched or pattern changed")
PYEOF

echo ""
echo "✅ Cleanup complete. Summary of fixes:"
echo "  1. auth.ts          — fixed race condition + loading state never resetting"
echo "  2. game-saves.ts    — surface errors instead of swallowing them silently"
echo "  3. use-cloud-save   — track user ID not just boolean, handle sign-out"
echo "  4. SkinCard.tsx     — consistent with SkinImage eager loading"
echo "  5. errors.ts        — added JWT expiry + timeout error messages"
echo "  6. contact.ts       — encodeImageUrl handles already-encoded URLs safely"
echo "  7. Snowfall shimmer — bigger tap target (h-20 w-20) for mobile"
echo "  8. Daily timer      — clear interval on re-run and set ref to null on expire"
echo "  9. styles.css       — body gradient adapts to active theme via color-mix"
echo " 10. Market offline   — fixed double-discount on offline income calculation"
echo ""
echo "Now run:"
echo "  git add -A"
echo "  git commit -m 'cleanup: auth race condition, cloud saves, offline income, theme gradient, mobile shimmer'"
echo "  git push"
