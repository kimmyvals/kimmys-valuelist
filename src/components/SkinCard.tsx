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
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

export function SkinCard({
  skin, onClick }: { skin: Skin; onClick: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
            setConfirmOpen(true);
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
