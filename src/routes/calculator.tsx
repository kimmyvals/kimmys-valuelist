import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Plus, Trash2, Scale, TrendingUp, TrendingDown, Share2, Lightbulb, ArrowLeftRight } from "lucide-react";
import type { Skin } from "@/components/SkinCard";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";

export const Route = createFileRoute("/calculator")({
  component: CalculatorPage,
  head: () => ({
    meta: [
      { title: "Trade Calculator — kimmy's valuelist" },
      { name: "description", content: "Build out both sides of a trade and see who wins or loses value. Share the result with a link." },
    ],
  }),
});

type ValueMode = "value" | "kt_value" | "sv_value";
type Entry = { id: string; skinId: string; mode: ValueMode };
type Side = { raw: string; entries: Entry[] };

const emptySide = (): Side => ({ raw: "", entries: [] });

function skinValueFor(skin: Skin, mode: ValueMode): number {
  const v = skin[mode];
  if (v != null) return Number(v);
  return Number(skin.value ?? 0);
}

function availableModes(skin: Skin): { mode: ValueMode; label: string; value: number }[] {
  const out: { mode: ValueMode; label: string; value: number }[] = [
    { mode: "value", label: "Base", value: Number(skin.value ?? 0) },
  ];
  if (skin.kt_value != null) out.push({ mode: "kt_value", label: "KT", value: Number(skin.kt_value) });
  if (skin.sv_value != null) out.push({ mode: "sv_value", label: "SV", value: Number(skin.sv_value) });
  return out;
}

function encodeState(you: Side, them: Side): string {
  const obj = {
    yr: you.raw,
    ye: you.entries.map(e => `${e.skinId}:${e.mode}`),
    tr: them.raw,
    te: them.entries.map(e => `${e.skinId}:${e.mode}`),
  };
  return btoa(JSON.stringify(obj));
}

function decodeState(encoded: string): { you: Side; them: Side } | null {
  try {
    const obj = JSON.parse(atob(encoded));
    const parseEntries = (arr: string[]): Entry[] =>
      arr.map(s => {
        const [skinId, mode] = s.split(":");
        return { id: crypto.randomUUID(), skinId, mode: (mode as ValueMode) ?? "value" };
      });
    return {
      you: { raw: obj.yr ?? "", entries: parseEntries(obj.ye ?? []) },
      them: { raw: obj.tr ?? "", entries: parseEntries(obj.te ?? []) },
    };
  } catch {
    return null;
  }
}

function SkinPicker({ skins, onPick, showImages }: { skins: Skin[]; onPick: (skin: Skin) => void; showImages: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Plus className="mr-2 h-4 w-4" /> Add skin
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name..." />
          <CommandList>
            <CommandEmpty>No skins found.</CommandEmpty>
            <CommandGroup>
              {skins.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.weapon_type} ${s.nickname ?? ""}`}
                  onSelect={() => { onPick(s); setOpen(false); }}
                >
                  <div className="flex w-full items-center gap-2">
                    {showImages && s.image_url && (
                      <img src={s.image_url} alt="" className="h-8 w-8 shrink-0 rounded object-contain" loading="eager" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{s.weapon_type} · {Number(s.value).toLocaleString()}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SideColumn({
  label, side, setSide, skinsById, skins, total, showImages,
}: {
  label: string; side: Side; setSide: (s: Side) => void;
  skinsById: Map<string, Skin>; skins: Skin[]; total: number; showImages: boolean;
}) {
  const update = (patch: Partial<Side>) => setSide({ ...side, ...patch });

  return (
    <Card className="flex flex-col gap-4 p-4" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span className="font-mono text-xl font-bold text-primary" style={{ textShadow: "var(--glow-primary)" }}>
          {total.toLocaleString()}
        </span>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Extra raw value</label>
        <Input inputMode="decimal" placeholder="0" value={side.raw} onChange={(e) => update({ raw: e.target.value })} />
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wider text-muted-foreground">Skins</label>
        {side.entries.length === 0 && (
          <p className="text-xs italic text-muted-foreground">No skins added.</p>
        )}
        {side.entries.map((entry) => {
          const skin = skinsById.get(entry.skinId);
          if (!skin) return null;
          const modes = availableModes(skin);
          const lineVal = skinValueFor(skin, entry.mode);
          return (
            <div key={entry.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2">
              {showImages && skin.image_url && (
                <img src={skin.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-contain" loading="eager" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{skin.name}</div>
                <div className="text-xs text-muted-foreground">{skin.weapon_type}</div>
              </div>
              <div className="flex gap-1">
                {modes.map((m) => (
                  <button key={m.mode} type="button"
                    onClick={() => update({ entries: side.entries.map((e) => e.id === entry.id ? { ...e, mode: m.mode } : e) })}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${entry.mode === m.mode ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    title={`${m.label}: ${m.value.toLocaleString()}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="w-20 text-right font-mono text-sm">{lineVal.toLocaleString()}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => update({ entries: side.entries.filter((e) => e.id !== entry.id) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        <SkinPicker skins={skins} showImages={showImages} onPick={(skin) => update({ entries: [...side.entries, { id: crypto.randomUUID(), skinId: skin.id, mode: "value" }] })} />
      </div>
    </Card>
  );
}

function CalculatorPage() {
  const search = Route.useSearch() as Record<string, string>;
  const [you, setYou] = useState<Side>(emptySide());
  const [them, setThem] = useState<Side>(emptySide());
  const [settings] = useSettings();
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Which side to add balancers to — default to loser's side, but user can flip
  const [balancerTarget, setBalancerTarget] = useState<"you" | "them">("you");

  const { data: skins = [] } = useQuery({
    queryKey: ["skins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skins").select("*").limit(1000);
      if (error) throw error;
      return data as unknown as Skin[];
    },
  });

  const skinsById = useMemo(() => {
    const m = new Map<string, Skin>();
    skins.forEach((s) => m.set(s.id, s));
    return m;
  }, [skins]);

  const sortedSkins = useMemo(() => [...skins].sort((a, b) => a.name.localeCompare(b.name)), [skins]);

  useEffect(() => {
    const t = (search as Record<string, string>).t;
    if (t && skins.length > 0) {
      const decoded = decodeState(t);
      if (decoded) { setYou(decoded.you); setThem(decoded.them); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skins.length]);

  const sideTotal = (side: Side) => {
    const raw = parseFloat(side.raw) || 0;
    const skinSum = side.entries.reduce((acc, e) => {
      const skin = skinsById.get(e.skinId);
      return acc + (skin ? skinValueFor(skin, e.mode) : 0);
    }, 0);
    return raw + skinSum;
  };

  const youTotal = sideTotal(you);
  const themTotal = sideTotal(them);
  const diff = themTotal - youTotal;
  const winning = diff > 0;
  const losing = diff < 0;

  // Auto-set balancer target to losing side when trade changes
  useEffect(() => {
    if (losing) setBalancerTarget("you");
    else if (winning) setBalancerTarget("them");
  }, [losing, winning]);

  const shareLink = () => {
    const encoded = encodeState(you, them);
    const url = `${window.location.origin}/calculator?t=${encoded}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard")).catch(() => toast.error("Copy failed"));
  };

  // Smarter balancer suggestions: find combinations of 1-3 skins that get closest to the gap
  const suggestions = useMemo(() => {
    if (diff === 0) return [];
    const gap = Math.abs(diff);
    if (gap < 10) return [];

    const targetSide = balancerTarget === "you" ? you : them;
    const targetIds = new Set(targetSide.entries.map(e => e.skinId));

    // Single skin suggestions — within 40% of gap
    const BAND = 0.40;
    const singles = skins
      .filter((s) => {
        const v = Number(s.value);
        return v > 0 && !targetIds.has(s.id) && v >= gap * (1 - BAND) && v <= gap * (1 + BAND);
      })
      .sort((a, b) => {
        // Sort by how close to the gap, then by demand desc
        const aDiff = Math.abs(Number(a.value) - gap);
        const bDiff = Math.abs(Number(b.value) - gap);
        if (Math.abs(aDiff - bDiff) > gap * 0.05) return aDiff - bDiff;
        return Number(b.demand ?? 0) - Number(a.demand ?? 0);
      })
      .slice(0, 6);

    return singles;
  }, [diff, balancerTarget, skins, you, them]);

  const addSuggestion = (skin: Skin) => {
    const entry = { id: crypto.randomUUID(), skinId: skin.id, mode: "value" as ValueMode };
    if (balancerTarget === "you") {
      setYou((s) => ({ ...s, entries: [...s.entries, entry] }));
    } else {
      setThem((s) => ({ ...s, entries: [...s.entries, entry] }));
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Scale className="h-3 w-3" /> Trade Calculator
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={shareLink}>
                <Share2 className="mr-2 h-4 w-4" /> Share link
              </Button>
              <SettingsMenu />
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Check a <span className="text-primary" style={{ textShadow: "var(--glow-primary)" }}>trade</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build both sides and see who wins value.
            <span className="ml-2 hidden sm:inline text-muted-foreground/60">You are the left column.</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-center gap-4 sm:hidden text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> Your side (top)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-border" /> Their side (bottom)</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SideColumn label="Your side" side={you} setSide={setYou} skinsById={skinsById} skins={sortedSkins} total={youTotal} showImages={settings.showImages} />
          <SideColumn label="Their side" side={them} setSide={setThem} skinsById={skinsById} skins={sortedSkins} total={themTotal} showImages={settings.showImages} />
        </div>

        {/* Result */}
        <Card className="mt-4 p-6" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your total vs. their total</div>
              <div className="mt-1 font-mono text-sm text-muted-foreground">
                {youTotal.toLocaleString()} — {themTotal.toLocaleString()}
              </div>
            </div>
            <div className={`flex items-center gap-2 rounded-md border px-4 py-2 ${
              winning ? "border-green-500/50 bg-green-500/10 text-green-300" :
              losing ? "border-red-500/50 bg-red-500/10 text-red-300" :
              "border-border bg-secondary text-muted-foreground"
            }`}>
              {winning ? <TrendingUp className="h-5 w-5" /> : losing ? <TrendingDown className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
              <div>
                <div className="text-xs uppercase tracking-wider">
                  {winning ? "You gain" : losing ? "You lose" : "Even"}
                </div>
                <div className="font-mono text-2xl font-bold">{Math.abs(diff).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Suggest balancers */}
          {diff !== 0 && Math.abs(diff) >= 10 && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowSuggestions((x) => !x)}
                >
                  <Lightbulb className="h-4 w-4 text-primary" />
                  {showSuggestions ? "Hide" : "Show"} balancers
                </button>
                {showSuggestions && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Adding to:</span>
                    <button
                      onClick={() => setBalancerTarget("you")}
                      className={`rounded px-2 py-0.5 font-medium transition ${balancerTarget === "you" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    >
                      Your side
                    </button>
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                    <button
                      onClick={() => setBalancerTarget("them")}
                      className={`rounded px-2 py-0.5 font-medium transition ${balancerTarget === "them" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    >
                      Their side
                    </button>
                  </div>
                )}
              </div>
              {showSuggestions && (
                <div className="mt-3">
                  {suggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No close matches found (gap: {Math.abs(diff).toLocaleString()}). Try adjusting the trade manually.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => addSuggestion(s)}
                          className="flex items-center gap-2 rounded-md border border-border/60 bg-background/30 p-2 text-left hover:border-primary/60 hover:bg-primary/5 transition-colors"
                        >
                          {settings.showImages && s.image_url && (
                            <img src={s.image_url} alt="" className="h-9 w-9 shrink-0 rounded object-contain bg-secondary/40" loading="eager" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.weapon_type} · {s.season}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-xs font-bold text-primary">{Number(s.value).toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">
                              off by {Math.abs(Number(s.value) - Math.abs(diff)).toLocaleString()}
                            </div>
                            {s.demand != null && <div className="text-[10px] text-muted-foreground">D{Number(s.demand)}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setYou(emptySide()); setThem(emptySide()); setShowSuggestions(false); }}>
              Reset
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
